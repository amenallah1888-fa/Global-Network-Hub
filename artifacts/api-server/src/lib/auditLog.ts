import { createHash } from "node:crypto";
import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = /password|passphrase|token|secret|authorization|cookie|credential|accesskey|privatekey|wallet|email|phone|address/i;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_STRING = 500;
const MAX_METADATA_ITEMS = 50;

function safeMetadata(value: unknown, depth = 0, key = ""): unknown {
  if (SENSITIVE_KEYS.test(key)) return REDACTED;
  if (depth > MAX_METADATA_DEPTH) return "[TRUNCATED]";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    return value
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
      .replace(/\+?\d[\d\s().-]{7,}\d/g, REDACTED)
      .slice(0, MAX_METADATA_STRING);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ITEMS).map((item) => safeMetadata(item, depth + 1));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).slice(0, MAX_METADATA_ITEMS).map(([childKey, childValue]) => [
        childKey,
        safeMetadata(childValue, depth + 1, childKey),
      ]),
    );
  }
  return "[UNSUPPORTED]";
}

function hashIp(req?: Request): string | undefined {
  const ip = req?.ip || req?.socket.remoteAddress;
  return ip ? createHash("sha256").update(ip).digest("hex").slice(0, 24) : undefined;
}

export type AuditEvent = {
  entityType: string;
  entityId: string;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown>;
  req?: Request;
};

export function auditLogValues(event: AuditEvent): typeof auditLogsTable.$inferInsert {
  const context = {
    ...(event.metadata ?? {}),
    ...(event.req
      ? {
          requestId: typeof event.req.id === "string" || typeof event.req.id === "number" ? event.req.id : undefined,
          ipHash: hashIp(event.req),
          method: event.req.method,
          path: event.req.path,
        }
      : {}),
  };

  return {
    id: `al_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    entityType: event.entityType.slice(0, 80),
    entityId: event.entityId.slice(0, 160),
    actorId: event.actorId.slice(0, 160),
    action: event.action.slice(0, 120),
    metadata: JSON.stringify(safeMetadata(context)),
  };
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await db.insert(auditLogsTable).values(auditLogValues(event));
  } catch {
    logger.error({ action: event.action.slice(0, 120) }, "Audit log write failed");
  }
}