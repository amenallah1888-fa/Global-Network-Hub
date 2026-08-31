import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const { limit, offset } = getPagination(res);
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, meId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);
  res.json(
    rows.map((n) => ({
      ...n,
      actorId: n.actorId ?? null,
      postId: n.postId ?? null,
      circleId: n.circleId ?? null,
      pitchId: n.pitchId ?? null,
      amount: n.amount ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  );
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, meId));
  res.json({ ok: true });
});

export default router;
