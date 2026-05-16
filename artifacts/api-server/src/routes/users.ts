import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  followsTable,
  pitchesTable,
  circleMembersTable,
  circlesTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  if (!u) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...u, following: false });
});

router.patch("/me", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};

  const allowed = ["name", "bio", "city", "country", "title", "company", "avatarKey", "linkedin", "twitter"] as const;
  type AllowedKey = typeof allowed[number];
  const updates: Partial<Record<AllowedKey, string>> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string") {
      const val = body[key].trim();
      if (val !== undefined) updates[key] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" }); return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, meId));
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  res.json({ ...u, following: false });
});

router.get("/users", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const all = await db.select().from(usersTable);
  const myFollows = await db.select().from(followsTable).where(eq(followsTable.followerId, meId));
  const set = new Set(myFollows.map((f) => f.followingId));
  res.json(all.map((u) => ({ ...u, following: set.has(u.id) })));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!u) { res.status(404).json({ error: "Not found" }); return; }

  const [follow] = await db.select().from(followsTable).where(
    and(eq(followsTable.followerId, meId), eq(followsTable.followingId, targetId)),
  );

  const pitches = await db.select().from(pitchesTable)
    .where(eq(pitchesTable.founderId, targetId))
    .orderBy(pitchesTable.createdAt);

  const memberships = await db.select({ circle: circlesTable })
    .from(circleMembersTable)
    .innerJoin(circlesTable, eq(circleMembersTable.circleId, circlesTable.id))
    .where(eq(circleMembersTable.userId, targetId));

  res.json({
    ...u,
    following: !!follow,
    pitches: pitches.map((p) => ({ ...p, coverKey: p.coverKey ?? null, backed: false })),
    circles: memberships.map((m) => ({ ...m.circle, coverKey: m.circle.coverKey ?? null, joined: false })),
  });
});

router.post("/users/:id/follow", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!targetId || targetId === meId) { res.status(400).json({ error: "Invalid target" }); return; }

  const existing = await db.select().from(followsTable).where(
    and(eq(followsTable.followerId, meId), eq(followsTable.followingId, targetId)),
  );

  let following: boolean;
  if (existing.length > 0) {
    await db.delete(followsTable).where(
      and(eq(followsTable.followerId, meId), eq(followsTable.followingId, targetId)),
    );
    await db.update(usersTable)
      .set({ followersCount: sql`GREATEST(${usersTable.followersCount} - 1, 0)` })
      .where(eq(usersTable.id, targetId));
    following = false;
  } else {
    await db.insert(followsTable).values({ followerId: meId, followingId: targetId });
    await db.update(usersTable)
      .set({ followersCount: sql`${usersTable.followersCount} + 1` })
      .where(eq(usersTable.id, targetId));
    following = true;
    await createNotification({ userId: targetId, type: "follow", actorId: meId, message: "started following you" });
  }

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  res.json({ userId: targetId, following, followersCount: u?.followersCount ?? 0 });
});

export default router;
