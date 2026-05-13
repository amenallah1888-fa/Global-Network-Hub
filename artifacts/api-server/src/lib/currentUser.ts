import type { Request } from "express";
import { verifyToken } from "./auth";

export const CURRENT_USER_ID = "u_me";

export function currentUserId(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const userId = verifyToken(token);
    if (userId) return userId;
  }
  return CURRENT_USER_ID;
}
