import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "@workspace/api-zod";
import { logger } from "./logger";

const MAX_PAGE_SIZE = 20;
const MAX_OFFSET = 1_000_000;
const MAX_BODY_KEYS = 100;
const MAX_STRING_LENGTH = 10_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function sanitizeString(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

const sanitizedString = z.string()
  .max(MAX_STRING_LENGTH)
  .transform(sanitizeString);

const safeJsonValue: z.ZodTypeAny = z.lazy((): z.ZodTypeAny => z.union([
  sanitizedString,
  z.number().refine(Number.isFinite, "number must be finite"),
  z.boolean(),
  z.null(),
  z.array(safeJsonValue).max(MAX_BODY_KEYS),
  z.record(z.string().max(100), safeJsonValue).refine(
    (value) => Object.keys(value).every((key) => !FORBIDDEN_KEYS.has(key)),
    "unsafe object key",
  ),
]));

const requestBodySchema = safeJsonValue.optional();
const requestQuerySchema = z.record(
  z.string().max(100),
  z.union([sanitizedString, z.array(sanitizedString).max(MAX_BODY_KEYS)]),
);
const requestParamsSchema = z.record(
  z.string().max(100),
  z.union([sanitizedString, z.array(sanitizedString).max(MAX_BODY_KEYS)]),
);
const requestPathSchema = z.array(
  z.string().min(1).max(100).regex(/^[A-Za-z0-9_.~-]+$/),
).max(50);

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

function replaceRequestProperty(
  req: Request,
  property: "body" | "query" | "params",
  value: unknown,
): void {
  Object.defineProperty(req, property, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

export function validateApiRequest(req: Request, res: Response, next: NextFunction): void {
  const body = requestBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "Invalid request payload",
      code: "INVALID_REQUEST",
    });
    return;
  }

  const query = requestQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      code: "INVALID_REQUEST",
    });
    return;
  }

  const params = requestParamsSchema.safeParse(req.params);
  if (!params.success || Object.values(params.data).some((value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) => !/^[A-Za-z0-9_.~-]{1,100}$/.test(item));
  })) {
    res.status(400).json({
      error: "Invalid route parameters",
      code: "INVALID_REQUEST",
    });
    return;
  }

  // This middleware runs before nested routers, so Express has not populated
  // req.params yet. Validate decoded URL segments globally to cover every
  // route parameter before a handler can consume it.
  let decodedPath: string[];
  try {
    decodedPath = req.originalUrl.split("?")[0]
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    res.status(400).json({ error: "Invalid route parameters", code: "INVALID_REQUEST" });
    return;
  }
  if (!requestPathSchema.safeParse(decodedPath).success) {
    res.status(400).json({ error: "Invalid route parameters", code: "INVALID_REQUEST" });
    return;
  }

  replaceRequestProperty(req, "body", body.data);
  replaceRequestProperty(req, "query", query.data);
  replaceRequestProperty(req, "params", params.data);

  const pagination = paginationSchema.safeParse(req.query);
  if (!pagination.success) {
    res.status(400).json({
      error: "Invalid pagination parameters",
      code: "INVALID_PAGINATION",
    });
    return;
  }

  res.locals.pagination = pagination.data;
  next();
}

export function getPagination(res: Response): Pagination {
  return res.locals.pagination ?? { limit: 20, offset: 0 };
}

export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        code: "INVALID_REQUEST",
        fields: parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid route parameters", code: "INVALID_REQUEST" });
      return;
    }
    req.params = parsed.data as typeof req.params;
    next();
  };
}

export function logUnhandledError(error: unknown, req: Request): void {
  logger.error({ err: error, method: req.method, path: req.path }, "Unhandled API error");
}
