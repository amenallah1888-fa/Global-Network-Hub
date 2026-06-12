import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { signToken } from "../lib/auth";
import { currentUserId } from "../lib/currentUser";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
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
    res.status(409).json({ error: "handle already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const avatarKey = "avatar" + (Math.floor(Math.random() * 6) + 1);

  const [user] = await db
    .insert(usersTable)
    .values({ id, handle, name: String(name).trim().slice(0, 60), passwordHash, avatarKey })
    .returning();

  const token = signToken(user.id);
  res.status(201).json({ token, user: { ...user, following: false } });
});

router.post("/auth/login", async (req, res): Promise<void> => {
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
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken(user.id);
  res.json({ token, user: { ...user, following: false } });
});

router.post("/auth/pi", async (req, res): Promise<void> => {
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
      res.status(401).json({ error: "Invalid Pi access token" });
      return;
    }
    piUser = (await piRes.json()) as { uid: string; username: string };
  } catch {
    res.status(503).json({ error: "Could not reach Pi Platform" });
    return;
  }

  if (piUser.uid !== uid) {
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

  const token = signToken(user.id);
  res.json({ token, user: { ...user, following: false } });
});

router.patch("/auth/promote-validator", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  await db.update(usersTable).set({ role: "validator" }).where(eq(usersTable.id, meId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  res.json({ ...user });
});

router.patch("/auth/promote-kyc", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  await db.update(usersTable).set({ kycStatus: "verified", kycVerifiedAt: new Date() }).where(eq(usersTable.id, meId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  res.json({ ...user });
});

export default router;
