import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, pitchUpdatesTable, pitchesTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

router.get("/pitches/:id/updates", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const updates = await db
    .select()
    .from(pitchUpdatesTable)
    .where(eq(pitchUpdatesTable.pitchId, id))
    .orderBy(desc(pitchUpdatesTable.createdAt)).limit(limit).offset(offset);
  res.json(updates);
});

router.post("/pitches/:id/updates", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const content = String(req.body?.content ?? "").trim();
  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const [pitch] = await db
    .select()
    .from(pitchesTable)
    .where(eq(pitchesTable.id, id));
  if (!pitch) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (pitch.founderId !== meId) {
    res.status(403).json({ error: "Only the founder can post updates" });
    return;
  }

  const updateId = `pu_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  await db.insert(pitchUpdatesTable).values({
    id: updateId,
    pitchId: id,
    authorId: meId,
    content,
  });

  const [created] = await db
    .select()
    .from(pitchUpdatesTable)
    .where(eq(pitchUpdatesTable.id, updateId));

  res.status(201).json(created);
});

export default router;
