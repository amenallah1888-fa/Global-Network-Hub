import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "@workspace/api-zod";
import { logger } from "./logger";

const MAX_PAGE_SIZE = 20;
const MAX_OFFSET = 1_000_000;
const MAX_BODY_KEYS = 100;
const MAX_STRING_LENGTH = 10_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findUnsafeValue(value: unknown, depth = 0): string | null {
  if (depth > 12) return "payload nesting is too deep";
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return "payload string is too long";
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_BODY_KEYS) return "payload array is too large";
    for (const item of value) {
      const issue = findUnsafeValue(item, depth + 1);
      if (issue) return issue;
    }
    return null;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length > MAX_BODY_KEYS) return "payload has too many fields";
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) return "unsafe object key";
      const issue = findUnsafeValue(value[key], depth + 1);
      if (issue) return issue;
    }
  }
  return null;
}

export function validateApiRequest(req: Request, res: Response, next: NextFunction): void {
  const bodyIssue = findUnsafeValue(req.body);
  if (bodyIssue) {
    res.status(400).json({
      error: "Invalid request payload",
      code: "INVALID_REQUEST",
    });
    return;
  }

  const queryIssue = findUnsafeValue(req.query);
  if (queryIssue) {
    res.status(400).json({
      error: "Invalid query parameters",
      code: "INVALID_REQUEST",
    });
    return;
  }

  const paramsIssue = findUnsafeValue(req.params);
  if (paramsIssue || Object.values(req.params).some((value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) => !/^[A-Za-z0-9_.~-]{1,100}$/.test(item));
  })) {
    res.status(400).json({
      error: "Invalid route parameters",
      code: "INVALID_REQUEST",
    });
    return;
  }

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
