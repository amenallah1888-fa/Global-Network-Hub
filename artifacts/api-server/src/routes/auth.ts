import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import {
  createSession,
  revokeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../lib/auth";
import { currentUserId } from "../lib/currentUser";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import { publicUser } from "../lib/userView";
import { authRateLimiter } from "../lib/rateLimit";
import { validateBody } from "../lib/requestSecurity";
import { z } from "@workspace/api-zod";
import { recordAuditEvent } from "../lib/auditLog";

const router: IRouter = Router();
const registerBody = z.object({
  handle: z.string().trim().regex(/^[a-z0-9_]{2,24}$/),
  name: z.string().trim().min(1).max(60),
  password: z.string().min(6).max(256),
}).strict();
const loginBody = z.object({
  handle: z.string().trim().min(2).max(24),
  password: z.string().min(1).max(256),
}).strict();
const piBody = z.object({
  accessToken: z.string().trim().min(1).max(4096),
  uid: z.string().trim().min(1).max(200),
  username: z.string().trim().max(100).optional(),
}).strict();

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
}

router.post("/auth/register", authRateLimiter, validateBody(registerBody), async (req, res): Promise<void> => {
  const { handle, name, password } = req.body ?? {};
  if (!handle || !name || !password) {
    res.status(400).json({ error: "handle, name, and password required" });
    return;
  }
  if (typeof handle !== "string" || !/^[a-z0-9_]{2,24}$/.test(handle)) {
    res.status(400).json({ error: "handle must be 2-24 lowercase alphanumeric or underscore" });
    return;
  }
  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "password must be at least 6 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.handle, handle));
  if (existing.length > 0) {
    await recordAuditEvent({
      entityType: "auth",
      entityId: "register",
      actorId: "anonymous",
      action: "AUTH_REGISTER_CONFLICT",
      metadata: { reason: "handle_taken" },
      req,
    });
    res.status(409).json({ error: "handle already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const avatarKey = "avatar" + (Math.floor(Math.random() * 6) + 1);

  const [user] = await db
    .insert(usersTable)
    .values({ id, handle, name: String(name).trim().slice(0, 60), passwordHash, avatarKey, reputationScore: 50 })
    .returning();

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  await recordAuditEvent({
    entityType: "auth",
    entityId: user.id,
    actorId: user.id,
    action: "AUTH_REGISTER_SUCCESS",
    req,
  });
  res.status(201).json({ token, user: { ...publicUser(user), following: false } });
});

router.post("/auth/login", authRateLimiter, validateBody(loginBody), async (req, res): Promise<void> => {
  const { handle, password } = req.body ?? {};
  if (!handle || !password) {
    res.status(400).json({ error: "handle and password required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.handle, String(handle).toLowerCase()));

  if (!user || !user.passwordHash) {
    await recordAuditEvent({
      entityType: "auth",
      entityId: "login",
      actorId: "anonymous",
      action: "AUTH_LOGIN_FAILURE",
      metadata: { reason: "invalid_credentials" },
      req,
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    await recordAuditEvent({
      entityType: "auth",
      entityId: "login",
      actorId: "anonymous",
      action: "AUTH_LOGIN_FAILURE",
      metadata: { reason: "invalid_credentials" },
      req,
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  await recordAuditEvent({
    entityType: "auth",
    entityId: user.id,
    actorId: user.id,
    action: "AUTH_LOGIN_SUCCESS",
    req,
  });
  res.json({ token, user: { ...publicUser(user), following: false } });
});

router.post("/auth/pi", authRateLimiter, validateBody(piBody), async (req, res): Promise<void> => {
  const { accessToken, uid, username } = req.body ?? {};
  if (!accessToken || !uid) {
    res.status(400).json({ error: "accessToken and uid required" });
    return;
  }

  let piUser: { uid: string; username: string } | null = null;
  try {
    const piRes = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${String(accessToken)}` },
    });
    if (!piRes.ok) {
      await recordAuditEvent({
        entityType: "auth",
        entityId: "pi",
        actorId: "anonymous",
        action: "AUTH_PI_FAILURE",
        metadata: { reason: "provider_rejected" },
        req,
      });
      res.status(401).json({ error: "Invalid Pi access token" });
      return;
    }
    piUser = (await piRes.json()) as { uid: string; username: string };
  } catch {
    await recordAuditEvent({
      entityType: "auth",
      entityId: "pi",
      actorId: "anonymous",
      action: "AUTH_PI_FAILURE",
      metadata: { reason: "provider_unavailable" },
      req,
    });
    res.status(503).json({ error: "Could not reach Pi Platform" });
    return;
  }

  if (piUser.uid !== uid) {
    await recordAuditEvent({
      entityType: "auth",
      entityId: "pi",
      actorId: "anonymous",
      action: "AUTH_PI_FAILURE",
      metadata: { reason: "uid_mismatch" },
      req,
    });
    res.status(401).json({ error: "Pi UID mismatch" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.piUid, piUser.uid));

  let user = existing;
  if (!user) {
    const rawHandle = piUser.username.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24) || "pi_user";
    const handle = rawHandle || "pi_user";
    const id = "u_pi_" + Date.now().toString(36);
    [user] = await db
      .insert(usersTable)
      .values({
        id,
        handle,
        name: piUser.username,
        piUid: piUser.uid,
        avatarKey: "avatar" + (Math.floor(Math.random() * 6) + 1),
      })
      .returning();
  }

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  await recordAuditEvent({
    entityType: "auth",
    entityId: user.id,
    actorId: user.id,
    action: "AUTH_PI_SUCCESS",
    req,
  });
  res.json({ token, user: { ...publicUser(user), following: false } });
});

async function logout(req: Request, res: Response): Promise<void> {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  await Promise.all([
    revokeSession(typeof cookieToken === "string" ? cookieToken : undefined),
    revokeSession(bearerToken),
  ]);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  res.json({ success: true });
}

router.post("/auth/logout", logout);
router.get("/auth/logout", logout);

router.patch("/auth/promote-validator", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  await db.update(usersTable).set({ role: "validator" }).where(eq(usersTable.id, meId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  await recordAuditEvent({
    entityType: "user",
    entityId: meId,
    actorId: meId,
    action: "PRIVILEGE_ESCALATION_VALIDATOR",
    metadata: { role: "validator" },
    req,
  });
  res.json(user ? publicUser(user) : {});
});

router.patch("/auth/promote-kyc", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  await db.update(usersTable).set({ kycStatus: "verified", kycVerifiedAt: new Date() }).where(eq(usersTable.id, meId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  await recordAuditEvent({
    entityType: "user",
    entityId: meId,
    actorId: meId,
    action: "ADMIN_KYC_VERIFICATION",
    metadata: { kycStatus: "verified" },
    req,
  });
  res.json(user ? publicUser(user) : {});
});

export default router;
