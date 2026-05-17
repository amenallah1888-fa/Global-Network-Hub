import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, milestonesTable, proposalsTable, auditLogsTable, pitchesTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function writeAudit(actorId: string, entityType: string, entityId: string, action: string, metadata?: object) {
  await db.insert(auditLogsTable).values({
    id: uid("al"),
    entityType,
    entityId,
    actorId,
    action,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

router.get("/proposals/:proposalId/milestones", async (req, res): Promise<void> => {
  const proposalId = Array.isArray(req.params.proposalId) ? req.params.proposalId[0] : req.params.proposalId;
  const milestones = await db.select().from(milestonesTable)
    .where(eq(milestonesTable.proposalId, proposalId))
    .orderBy(asc(milestonesTable.order));
  res.json(milestones.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    completedAt: m.completedAt?.toISOString() ?? null,
  })));
});

router.post("/proposals/:proposalId/milestones", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const proposalId = Array.isArray(req.params.proposalId) ? req.params.proposalId[0] : req.params.proposalId;
  const body = req.body ?? {};

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, proposalId));
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, proposal.pitchId));
  if (!pitch || pitch.founderId !== meId) {
    res.status(403).json({ error: "Only the founder can create milestones" }); return;
  }

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const percentageOfFunds = parseInt(String(body.percentageOfFunds ?? "0"), 10);
  const order = parseInt(String(body.order ?? "0"), 10);

  if (!title || percentageOfFunds <= 0 || percentageOfFunds > 100) {
    res.status(400).json({ error: "title and valid percentageOfFunds (1-100) required" }); return;
  }

  const id = uid("ms");
  await db.insert(milestonesTable).values({ id, proposalId, pitchId: proposal.pitchId, title, description, percentageOfFunds, order });
  await writeAudit(meId, "milestone", id, "created", { title, percentageOfFunds });

  const [created] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), completedAt: null });
});

router.patch("/milestones/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const body = req.body ?? {};

  const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
  if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, milestone.pitchId));
  if (!pitch) { res.status(404).json({ error: "Pitch not found" }); return; }

  const allowed = ["locked", "pending_proof", "released"];
  const newStatus = String(body.status ?? "").trim();
  if (!allowed.includes(newStatus)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` }); return;
  }

  const proofUrl = typeof body.proofUrl === "string" && body.proofUrl.trim()
    ? body.proofUrl.trim() : milestone.proofUrl;

  const updates: Partial<typeof milestonesTable.$inferSelect> = {
    status: newStatus,
    proofUrl,
    ...(newStatus === "released" ? { completedAt: new Date() } : {}),
  };

  await db.update(milestonesTable).set(updates).where(eq(milestonesTable.id, id));
  await writeAudit(meId, "milestone", id, `status_changed_to_${newStatus}`, { proofUrl });

  const [updated] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), completedAt: updated.completedAt?.toISOString() ?? null });
});

export default router;
