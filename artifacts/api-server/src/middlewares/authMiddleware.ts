import type { Request, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import {
  SESSION_COOKIE,
  verifySession,
} from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

function tokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    return token || undefined;
  }
  return undefined;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = tokenFromRequest(req);
    const userId = token ? await verifySession(token) : null;
    if (!userId) {
      res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export type AppRole = "user" | "validator" | "admin" | "investor" | "creator";

export function requireRole(roles: readonly AppRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
      return;
    }
    if (!roles.includes(req.user.role as AppRole)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}