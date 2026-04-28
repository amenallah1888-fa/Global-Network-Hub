import type { Request } from "express";

export const CURRENT_USER_ID = "u_me";

export function currentUserId(_req: Request): string {
  return CURRENT_USER_ID;
}
