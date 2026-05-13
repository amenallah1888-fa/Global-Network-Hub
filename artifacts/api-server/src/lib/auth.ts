import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "oasis-dev-secret-change-in-production";

export function signToken(userId: string): string {
  return (jwt as any).sign({ sub: userId }, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = (jwt as any).verify(token, SECRET) as { sub: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
