import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, reportsTable, pitchesTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";

const router: IRouter = Router();

router.post("/pitches/:id/report", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reason = String(req.body?.reason ?? "").trim();

  const existing = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.reporterId, meId),
        eq(reportsTable.targetId, id),
      ),
    );

  if (existing.length === 0) {
    await db.insert(reportsTable).values({
      reporterId: meId,
      targetId: id,
      targetType: "pitch",
      reason,
    });
    await db
      .update(pitchesTable)
      .set({ reportsCount: sql`${pitchesTable.reportsCount} + 1` })
      .where(eq(pitchesTable.id, id));
  }

  res.json({ reported: true });
});

export default router;
