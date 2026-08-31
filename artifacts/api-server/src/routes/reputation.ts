import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, reputationEventsTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

router.get("/users/:id/reputation", async (req, res): Promise<void> => {
  currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);

  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    handle: usersTable.handle,
    reputationScore: usersTable.reputationScore,
    kycStatus: usersTable.kycStatus,
    role: usersTable.role,
  }).from(usersTable).where(eq(usersTable.id, id));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const events = await db.select().from(reputationEventsTable)
    .where(eq(reputationEventsTable.userId, id))
    .orderBy(desc(reputationEventsTable.createdAt))
    .limit(limit).offset(offset);

  const breakdown = events.reduce((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + e.delta;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    ...user,
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    breakdown,
    tier: reputationTier(user.reputationScore),
  });
});

router.get("/reputation/leaderboard", async (_req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const top = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    handle: usersTable.handle,
    avatarKey: usersTable.avatarKey,
    reputationScore: usersTable.reputationScore,
    kycStatus: usersTable.kycStatus,
  }).from(usersTable)
    .orderBy(desc(usersTable.reputationScore))
    .limit(limit).offset(offset);

  res.json(top.map((u) => ({ ...u, tier: reputationTier(u.reputationScore) })));
});

function reputationTier(score: number): string {
  if (score >= 100) return "Diamond";
  if (score >= 50) return "Gold";
  if (score >= 25) return "Silver";
  if (score >= 10) return "Bronze";
  return "Newcomer";
}

export default router;
