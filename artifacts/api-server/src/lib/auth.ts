import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessionsTable, db } from "@workspace/db";

const SECRET = process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? (
  process.env.NODE_ENV === "production"
    ? ""
    : "oasis-development-secret"
);
const JWT_ISSUER = "humanverse-api";
const JWT_AUDIENCE = "humanverse-clients";
export const SESSION_COOKIE = "oasis_session";
export const SESSION_MAX_AGE_MS = 15 * 60 * 1000;

if (!SECRET) {
  throw new Error("JWT_SECRET or SESSION_SECRET must be configured");
}

type SessionClaims = {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
};

export type SessionCookieOptions = {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  maxAge: number;
  path: "/";
};

export const sessionCookieOptions: SessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: SESSION_MAX_AGE_MS,
  path: "/",
};

export function signToken(userId: string): string {
  const jti = randomUUID();
  return jwt.sign({ sub: userId, jti }, SECRET, {
    expiresIn: "15m",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyToken(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as SessionClaims;
    return typeof payload.sub === "string" && typeof payload.jti === "string" ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = signToken(userId);
  const claims = verifyToken(token);
  if (!claims?.exp) throw new Error("Could not create authenticated session");

  await db.insert(authSessionsTable).values({
    id: claims.jti,
    userId,
    expiresAt: new Date(claims.exp * 1000),
  });
  return token;
}

export async function verifySession(token: string): Promise<string | null> {
  const claims = verifyToken(token);
  if (!claims) return null;

  const [session] = await db
    .select({ userId: authSessionsTable.userId })
    .from(authSessionsTable)
    .where(and(
      eq(authSessionsTable.id, claims.jti),
      eq(authSessionsTable.userId, claims.sub),
      isNull(authSessionsTable.revokedAt),
      gt(authSessionsTable.expiresAt, new Date()),
    ))
    .limit(1);

  return session?.userId ?? null;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const claims = verifyToken(token);
  if (!claims) return;
  await db
    .update(authSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessionsTable.id, claims.jti), isNull(authSessionsTable.revokedAt)));
}
