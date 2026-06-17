import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  pitchesTable,
  pitchBackersTable,
  markersTable,
  usersTable,
  transactionsTable,
  serviceAppsTable,
  milestonesTable,
  projectDocumentsTable,
  appDirectoryTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";
import { awardXp } from "../lib/xpEngine";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function computeTrustScore(pitch: typeof pitchesTable.$inferSelect): number {
  return pitch.trustScore ?? 0;
}

function isAutoVerified(pitch: typeof pitchesTable.$inferSelect): boolean {
  return pitch.verificationStatus === "verified" || (pitch.trustScore ?? 0) >= 100;
}

function parseValidatorApprovals(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function parseRequirements(raw: string | null | undefined): { type: string; description: string }[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function decoratePitch(p: typeof pitchesTable.$inferSelect, backed: boolean) {
  return {
    ...p,
    coverKey: p.coverKey ?? null,
    backed,
    verified: isAutoVerified(p),
    trustScore: computeTrustScore(p),
    requirements: parseRequirements(p.requirements),
    validatorApprovals: parseValidatorApprovals(p.validatorApprovals),
  };
}

router.get("/pitches", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const all = await db.select().from(pitchesTable).orderBy(desc(pitchesTable.trending), desc(pitchesTable.createdAt));
  const mine = await db.select().from(pitchBackersTable).where(eq(pitchBackersTable.userId, meId));
  const set = new Set(mine.map((m) => m.pitchId));
  res.json(all.map((p) => decoratePitch(p, set.has(p.id))));
});

router.post("/pitches", async (req, res): Promise<void> => {
  const meId = currentUserId(req);

  const [me] = await db.select({ kycStatus: usersTable.kycStatus }).from(usersTable).where(eq(usersTable.id, meId));
  if (!me || me.kycStatus !== "verified") {
    res.status(403).json({ error: "KYC verification required to post a Pitch. Complete identity verification first.", code: "KYC_REQUIRED" }); return;
  }

  const body = req.body ?? {};
  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const raising = parseInt(String(body.raising ?? "0"), 10);
  const stage = String(body.stage ?? "").trim();
  const industry = String(body.industry ?? "").trim();
  const city = String(body.city ?? "").trim();
  const coverKey = typeof body.coverKey === "string" && body.coverKey.length > 0 ? body.coverKey : null;
  const x = typeof body.x === "number" && Number.isFinite(body.x) ? body.x : null;
  const y = typeof body.y === "number" && Number.isFinite(body.y) ? body.y : null;
  const entityType = body.entityType === "service_app" ? "service_app" : "startup";
  const serviceCategory = typeof body.serviceCategory === "string" && body.serviceCategory.length > 0 ? body.serviceCategory : null;
  const roadmapUrl = typeof body.roadmapUrl === "string" && body.roadmapUrl.length > 0 ? body.roadmapUrl : null;
  const founderLinkedin = typeof body.founderLinkedin === "string" && body.founderLinkedin.length > 0 ? body.founderLinkedin : null;
  const proofOfRealityUrl = typeof body.proofOfRealityUrl === "string" && body.proofOfRealityUrl.length > 0 ? body.proofOfRealityUrl : null;
  const portfolioUrl = typeof body.portfolioUrl === "string" && body.portfolioUrl.length > 0 ? body.portfolioUrl : null;
  const experienceDescription = typeof body.experienceDescription === "string" && body.experienceDescription.length > 0 ? body.experienceDescription : null;
  const requirementsRaw = Array.isArray(body.requirements) ? JSON.stringify(body.requirements) : null;

  if (!title || !summary || !stage || !industry || !city || !Number.isFinite(raising) || raising <= 0) {
    res.status(400).json({ error: "Missing or invalid fields" }); return;
  }

  const id = uid("pi");
  await db.insert(pitchesTable).values({
    id, founderId: meId, title, stage, industry, raising, raised: 0, city, summary,
    coverKey, backersCount: 0, trending: false, entityType, serviceCategory,
    roadmapUrl, founderLinkedin, proofOfRealityUrl, portfolioUrl, experienceDescription,
    requirements: requirementsRaw,
  });

  const markerType = entityType === "service_app" ? "service"
    : ["biotech", "climate", "robotics", "ai", "deeptech"].includes(industry.toLowerCase()) ? "project" : "business";

  await db.insert(markersTable).values({
    id: `m_${id}`, type: markerType, label: title, city, x: x ?? 0.5, y: y ?? 0.5,
    meta: entityType === "service_app" ? `${serviceCategory ?? "Service"} · ${city}` : `${stage} · ${industry}`,
    refId: id,
  });

  const [created] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));

  await awardXp(meId, "pitch_launched");

  res.status(201).json(decoratePitch(created, false));
});

router.get("/pitches/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  if (!pitch) { res.status(404).json({ error: "Not found" }); return; }

  const [backer] = await db.select().from(pitchBackersTable).where(and(eq(pitchBackersTable.pitchId, id), eq(pitchBackersTable.userId, meId)));
  const [founder] = await db.select().from(usersTable).where(eq(usersTable.id, pitch.founderId));

  const related = await db.select().from(pitchesTable).where(eq(pitchesTable.industry, pitch.industry))
    .orderBy(desc(pitchesTable.raised)).limit(4);

  const supporters = await db.select({ userId: pitchBackersTable.userId, createdAt: pitchBackersTable.createdAt })
    .from(pitchBackersTable).where(eq(pitchBackersTable.pitchId, id))
    .orderBy(desc(pitchBackersTable.createdAt)).limit(20);

  const supporterIds = supporters.map((s) => s.userId);
  const supporterUsers = supporterIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, avatarKey: usersTable.avatarKey, handle: usersTable.handle })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(supporterIds.map((uid) => sql`${uid}`), sql`, `)}])`)
    : [];

  const requirements = parseRequirements(pitch.requirements);
  let suggestedServices: typeof serviceAppsTable.$inferSelect[] = [];
  if (requirements.length > 0) {
    const allServices = await db.select().from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore)).limit(50);
    const needTypes = requirements.map((r) => r.type.toLowerCase());
    suggestedServices = allServices.filter((s) =>
      needTypes.some((nt) => s.category.toLowerCase().includes(nt) || s.title.toLowerCase().includes(nt))
    ).slice(0, 3);
  }

  res.json({
    ...decoratePitch(pitch, !!backer),
    founder: founder ? { ...founder } : null,
    related: related.filter((p) => p.id !== id).slice(0, 3).map((p) => decoratePitch(p, false)),
    supporters: supporterUsers,
    suggestedServices,
  });
});

router.patch("/pitches/:id/requirements", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  if (!pitch) { res.status(404).json({ error: "Not found" }); return; }
  if (pitch.founderId !== meId) { res.status(403).json({ error: "Forbidden" }); return; }

  const requirements = Array.isArray(req.body?.requirements) ? req.body.requirements : [];
  await db.update(pitchesTable).set({ requirements: JSON.stringify(requirements) }).where(eq(pitchesTable.id, id));
  res.json({ requirements });
});

router.patch("/pitches/:id/proof-links", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  if (!pitch) { res.status(404).json({ error: "Not found" }); return; }
  if (pitch.founderId !== meId) { res.status(403).json({ error: "Only the project founder can update proof links" }); return; }

  const updates: Record<string, string | null> = {};
  if (typeof req.body?.founderLinkedin === "string") updates.founderLinkedin = req.body.founderLinkedin.trim() || null;
  if (typeof req.body?.proofOfRealityUrl === "string") updates.proofOfRealityUrl = req.body.proofOfRealityUrl.trim() || null;
  if (typeof req.body?.roadmapUrl === "string") updates.roadmapUrl = req.body.roadmapUrl.trim() || null;
  if (typeof req.body?.portfolioUrl === "string") updates.portfolioUrl = req.body.portfolioUrl.trim() || null;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields provided" }); return; }
  await db.update(pitchesTable).set(updates as any).where(eq(pitchesTable.id, id));
  const [updated] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  res.json(decoratePitch(updated, true));
});

router.post("/pitches/:id/back", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const amount = parseInt(String(req.body?.amount ?? "0"), 10);
  if (!id || !Number.isFinite(amount) || amount < 0) { res.status(400).json({ error: "Invalid input" }); return; }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  if (!pitch) { res.status(404).json({ error: "Not found" }); return; }

  const existing = await db.select().from(pitchBackersTable).where(and(eq(pitchBackersTable.pitchId, id), eq(pitchBackersTable.userId, meId)));
  if (existing.length === 0) {
    await db.insert(pitchBackersTable).values({ pitchId: id, userId: meId });
    await db.update(pitchesTable).set({ backersCount: sql`${pitchesTable.backersCount} + 1`, raised: sql`${pitchesTable.raised} + ${amount}` }).where(eq(pitchesTable.id, id));
    const txId = uid("tx");
    await db.insert(transactionsTable).values({ id: txId, userId: meId, pitchId: id, amount, type: pitch.entityType === "service_app" ? "hire" : "invest" });
    await createNotification({
      userId: pitch.founderId, type: "pitch_backed", actorId: meId, pitchId: id, amount,
      message: amount > 0 ? `expressed interest in ${pitch.title} (${amount.toLocaleString()} π)` : `expressed interest in ${pitch.title}`,
    });
  }

  const [updated] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  res.json(decoratePitch(updated, true));
});

router.get("/pitches/top/ranked", async (_req, res): Promise<void> => {
  const top = await db.select().from(pitchesTable)
    .orderBy(desc(pitchesTable.verificationStatus), desc(pitchesTable.raised), desc(pitchesTable.backersCount))
    .limit(5);
  res.json(top.map((p) => decoratePitch(p, false)));
});

router.get("/pitches/:id/milestones", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.pitchId, id)).orderBy(asc(milestonesTable.order));
  res.json(milestones.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), completedAt: m.completedAt?.toISOString() ?? null })));
});

router.get("/pitches/:id/documents", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const docs = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.projectId, id)).orderBy(desc(projectDocumentsTable.uploadedAt));
  res.json(docs.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })));
});

router.post("/pitches/:id/documents", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const documentUrl = String(req.body?.documentUrl ?? "").trim();
  const documentType = String(req.body?.documentType ?? "proof").trim();
  if (!documentUrl) { res.status(400).json({ error: "documentUrl required" }); return; }
  const docId = uid("doc");
  await db.insert(projectDocumentsTable).values({ id: docId, projectId: id, documentUrl, documentType, status: "PENDING" });
  const [doc] = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.id, docId));
  res.status(201).json({ ...doc, uploadedAt: doc.uploadedAt.toISOString() });
});

router.patch("/pitches/:id/verify", async (req, res): Promise<void> => {
  currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const status = req.body?.status === "verified" ? "verified" : "pending";
  await db.update(pitchesTable).set({ verificationStatus: status }).where(eq(pitchesTable.id, id));
  const [updated] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(decoratePitch(updated, false));
});

const VALID_BLOCKS = ["identity", "reality", "roadmap", "portfolio"] as const;
const BLOCK_POINTS = 25;

router.post("/pitches/:id/validate-block", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const block = String(req.body?.block ?? "").trim();
  const action = String(req.body?.action ?? "").trim();

  if (!VALID_BLOCKS.includes(block as any) || !["approve", "reject"].includes(action)) {
    res.status(400).json({ error: `block must be one of: ${VALID_BLOCKS.join(", ")}; action must be approve or reject` }); return;
  }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  if (!me || (me.role !== "validator" && me.role !== "admin")) {
    res.status(403).json({ error: "Validator or Admin role required to approve blocks" }); return;
  }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  if (!pitch) { res.status(404).json({ error: "Project not found" }); return; }

  if (pitch.founderId === meId) {
    res.status(403).json({ error: "Conflict of interest: founders cannot approve or reject their own project's verification blocks" }); return;
  }

  const approvals = parseValidatorApprovals(pitch.validatorApprovals);
  approvals[block] = action;

  const newTrustScore = Math.min(100, Object.values(approvals).filter(v => v === "approve").length * BLOCK_POINTS);
  const autoVerified = newTrustScore >= 100;

  await db.update(pitchesTable).set({
    validatorApprovals: JSON.stringify(approvals),
    trustScore: newTrustScore,
    ...(autoVerified ? { verificationStatus: "verified" } : {}),
  }).where(eq(pitchesTable.id, id));

  let migrated = false;
  if (autoVerified) {
    if (pitch.entityType === "service_app") {
      const existing = await db.select().from(serviceAppsTable).where(eq(serviceAppsTable.id, `svc_${id}`));
      if (existing.length === 0) {
        migrated = true;
        await db.insert(serviceAppsTable).values({
          id: `svc_${id}`,
          providerId: pitch.founderId,
          title: pitch.title,
          category: pitch.serviceCategory ?? "Development",
          description: pitch.summary,
          pricePi: 0,
          city: pitch.city,
          country: null,
          portfolioUrl: pitch.portfolioUrl,
          trustScore: 100,
          hiredCount: 0,
          rating: 5,
        });
      }
    } else if (pitch.entityType === "app") {
      const existing = await db.select().from(appDirectoryTable).where(eq(appDirectoryTable.id, `app_${id}`));
      if (existing.length === 0) {
        migrated = true;
        const safeLink = pitch.roadmapUrl?.startsWith("https://") ? pitch.roadmapUrl : "https://pi-apps.io";
        await db.insert(appDirectoryTable).values({
          id: `app_${id}`,
          name: pitch.title,
          tagline: pitch.summary.slice(0, 120),
          description: pitch.summary,
          platform: "Both",
          category: pitch.industry,
          verifiedLink: safeLink,
          logoUrl: null,
          securityScore: 100,
          submissionStatus: "approved",
          submittedBy: pitch.founderId,
        });
      }
    }
  }

  const [updated] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, id));
  res.json({ ...decoratePitch(updated, false), migrated });
});

router.get("/pitches/my", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const mine = await db.select().from(pitchesTable).where(eq(pitchesTable.founderId, meId)).orderBy(desc(pitchesTable.createdAt));
  res.json(mine.map(p => decoratePitch(p, false)));
});

export default router;
