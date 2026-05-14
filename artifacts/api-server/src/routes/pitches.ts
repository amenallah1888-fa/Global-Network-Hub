import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  pitchesTable,
  pitchBackersTable,
  markersTable,
  usersTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

router.get("/pitches", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const all = await db
    .select()
    .from(pitchesTable)
    .orderBy(desc(pitchesTable.trending), desc(pitchesTable.createdAt));
  const mine = await db
    .select()
    .from(pitchBackersTable)
    .where(eq(pitchBackersTable.userId, meId));
  const set = new Set(mine.map((m) => m.pitchId));
  res.json(
    all.map((p) => ({
      ...p,
      coverKey: p.coverKey ?? null,
      backed: set.has(p.id),
    })),
  );
});

router.post("/pitches", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};
  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const raising = parseInt(String(body.raising ?? "0"), 10);
  const stage = String(body.stage ?? "").trim();
  const industry = String(body.industry ?? "").trim();
  const city = String(body.city ?? "").trim();
  const coverKey =
    typeof body.coverKey === "string" && body.coverKey.length > 0
      ? body.coverKey
      : null;
  const x =
    typeof body.x === "number" && Number.isFinite(body.x) ? body.x : null;
  const y =
    typeof body.y === "number" && Number.isFinite(body.y) ? body.y : null;

  if (
    !title ||
    !summary ||
    !stage ||
    !industry ||
    !city ||
    !Number.isFinite(raising) ||
    raising <= 0
  ) {
    res.status(400).json({ error: "Missing or invalid fields" });
    return;
  }

  const id = `pi_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  await db.insert(pitchesTable).values({
    id,
    founderId: meId,
    title,
    stage,
    industry,
    raising,
    raised: 0,
    city,
    summary,
    coverKey,
    backersCount: 0,
    trending: false,
  });

  const markerType =
    industry.toLowerCase() === "biotech" ||
    industry.toLowerCase() === "climate" ||
    industry.toLowerCase() === "robotics" ||
    industry.toLowerCase() === "ai" ||
    industry.toLowerCase() === "deeptech"
      ? "project"
      : "business";

  const mx = x !== null ? x : 0.5;
  const my = y !== null ? y : 0.5;

  await db.insert(markersTable).values({
    id: `m_${id}`,
    type: markerType,
    label: title,
    city,
    x: mx,
    y: my,
    meta: `${stage} · ${industry}`,
    refId: id,
  });

  const [created] = await db
    .select()
    .from(pitchesTable)
    .where(eq(pitchesTable.id, id));

  res
    .status(201)
    .json({ ...created, coverKey: created.coverKey ?? null, backed: false });
});

router.get("/pitches/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [pitch] = await db
    .select()
    .from(pitchesTable)
    .where(eq(pitchesTable.id, id));
  if (!pitch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [backer] = await db
    .select()
    .from(pitchBackersTable)
    .where(
      and(
        eq(pitchBackersTable.pitchId, id),
        eq(pitchBackersTable.userId, meId),
      ),
    );

  const [founder] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, pitch.founderId));

  // fetch related pitches from same industry (exclude this one)
  const related = await db
    .select()
    .from(pitchesTable)
    .where(eq(pitchesTable.industry, pitch.industry))
    .orderBy(desc(pitchesTable.raised))
    .limit(4);

  res.json({
    ...pitch,
    coverKey: pitch.coverKey ?? null,
    backed: !!backer,
    founder: founder ? { ...founder } : null,
    related: related
      .filter((p) => p.id !== id)
      .slice(0, 3)
      .map((p) => ({ ...p, coverKey: p.coverKey ?? null, backed: false })),
  });
});

router.post("/pitches/:id/back", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const amount = parseInt(String(req.body?.amount ?? "0"), 10);
  if (!id || !Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: "Invalid input" });
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

  const existing = await db
    .select()
    .from(pitchBackersTable)
    .where(
      and(
        eq(pitchBackersTable.pitchId, id),
        eq(pitchBackersTable.userId, meId),
      ),
    );
  if (existing.length === 0) {
    await db
      .insert(pitchBackersTable)
      .values({ pitchId: id, userId: meId });
    await db
      .update(pitchesTable)
      .set({
        backersCount: sql`${pitchesTable.backersCount} + 1`,
        raised: sql`${pitchesTable.raised} + ${amount}`,
      })
      .where(eq(pitchesTable.id, id));
    await createNotification({
      userId: pitch.founderId,
      type: "pitch_backed",
      actorId: meId,
      pitchId: id,
      amount,
      message:
        amount > 0
          ? `expressed interest in ${pitch.title} ($${amount.toLocaleString()})`
          : `expressed interest in ${pitch.title}`,
    });
  }

  const [updated] = await db
    .select()
    .from(pitchesTable)
    .where(eq(pitchesTable.id, id));
  res.json({ ...updated, coverKey: updated.coverKey ?? null, backed: true });
});

export default router;
