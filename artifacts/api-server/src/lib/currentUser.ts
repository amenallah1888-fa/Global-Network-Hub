import type { Request } from "express";

export function currentUserId(req: Request): string {
  if (!req.user?.id) {
    throw new Error("Authenticated request required");
  }
  return req.user.id;
}
