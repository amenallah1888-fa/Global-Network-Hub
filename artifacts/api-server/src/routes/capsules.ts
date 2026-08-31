import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, projectCapsulesTable, pitchesTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";
import { awardXp } from "../lib/xpEngine";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.post("/pitches/:id/capsules", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const pitchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, pitchId));
  if (!pitch) { res.status(404).json({ error: "Pitch not found" }); return; }
  if (pitch.founderId !== meId) { res.status(403).json({ error: "Only the founder can post capsules" }); return; }

  const title = String(req.body?.title ?? "").trim();
  const body = String(req.body?.body ?? "").trim();
  const videoUrl = typeof req.body?.videoUrl === "string" && req.body.videoUrl.trim() ? req.body.videoUrl.trim() : null;
  const codeLogUrl = typeof req.body?.codeLogUrl === "string" && req.body.codeLogUrl.trim() ? req.body.codeLogUrl.trim() : null;

  if (!title || !body) { res.status(400).json({ error: "title and body are required" }); return; }

  const [last] = await db.select({ weekNumber: projectCapsulesTable.weekNumber })
    .from(projectCapsulesTable).where(eq(projectCapsulesTable.pitchId, pitchId))
    .orderBy(desc(projectCapsulesTable.weekNumber)).limit(1);

  const weekNumber = (last?.weekNumber ?? 0) + 1;

  const id = uid("cap");
  await db.insert(projectCapsulesTable).values({ id, pitchId, founderId: meId, title, body, videoUrl, codeLogUrl, weekNumber });

  await awardXp(meId, "capsule_posted");

  const [created] = await db.select().from(projectCapsulesTable).where(eq(projectCapsulesTable.id, id));
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/pitches/:id/capsules", async (req, res): Promise<void> => {
  currentUserId(req);
  const pitchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);

  const [pitch] = await db.select({ founderId: pitchesTable.founderId, title: pitchesTable.title })
    .from(pitchesTable).where(eq(pitchesTable.id, pitchId));
  if (!pitch) { res.status(404).json({ error: "Not found" }); return; }

  const capsules = await db.select().from(projectCapsulesTable)
    .where(eq(projectCapsulesTable.pitchId, pitchId))
    .orderBy(asc(projectCapsulesTable.weekNumber)).limit(limit).offset(offset);

  const [founder] = await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey })
    .from(usersTable).where(eq(usersTable.id, pitch.founderId));

  res.json({
    pitchTitle: pitch.title,
    founder: founder ?? null,
    totalCapsules: capsules.length,
    capsules: capsules.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  });
});

router.get("/capsules/recent", async (req, res): Promise<void> => {
  currentUserId(req);
  const { limit, offset } = getPagination(res);

  const capsules = await db.select({
    id: projectCapsulesTable.id,
    pitchId: projectCapsulesTable.pitchId,
    title: projectCapsulesTable.title,
    body: projectCapsulesTable.body,
    weekNumber: projectCapsulesTable.weekNumber,
    createdAt: projectCapsulesTable.createdAt,
    founderId: projectCapsulesTable.founderId,
  }).from(projectCapsulesTable).orderBy(desc(projectCapsulesTable.createdAt)).limit(limit).offset(offset);

  const pitchIds = [...new Set(capsules.map((c) => c.pitchId))];
  const pitches = pitchIds.length > 0
    ? await db.select({ id: pitchesTable.id, title: pitchesTable.title, industry: pitchesTable.industry })
        .from(pitchesTable).where(sql`${pitchesTable.id} = ANY(ARRAY[${sql.join(pitchIds.map((id) => sql`${id}`), sql`, `)}])`)
    : [];
  const pitchMap = new Map(pitches.map((p) => [p.id, p]));

  res.json(capsules.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    pitch: pitchMap.get(c.pitchId) ?? null,
  })));
});

export default router;
