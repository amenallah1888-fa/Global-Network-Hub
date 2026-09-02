import type { Request, RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  name: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let lastPrunedAt = 0;

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function pruneExpired(now: number): void {
  if (now - lastPrunedAt < 60_000) return;
  lastPrunedAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    pruneExpired(now);

    const key = `${options.name}:${clientIp(req)}`;
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.limit - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("RateLimit-Policy", `${options.limit};w=${Math.ceil(options.windowMs / 1000)}`);
    res.setHeader("RateLimit", `${remaining};w=${resetSeconds}`);
    res.setHeader("X-RateLimit-Limit", options.limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > options.limit) {
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    next();
  };
}

export const generalRateLimiter = createRateLimiter({
  name: "general-api",
  windowMs: 60_000,
  limit: 100,
});

export const authRateLimiter = createRateLimiter({
  name: "auth-attempt",
  windowMs: 60_000,
  limit: 5,
});

export const aiRateLimiter = createRateLimiter({
  name: "ai-resource",
  windowMs: 60_000,
  limit: 20,
});

export const uploadRateLimiter = createRateLimiter({
  name: "upload-resource",
  windowMs: 60_000,
  limit: 30,
});