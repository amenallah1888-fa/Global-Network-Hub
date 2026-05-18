import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, smartAgreementsTable, projectDocumentsTable, pitchesTable, milestonesTable, auditLogsTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { hashTerms } from "../lib/piRpc";
import { runAmlCheck } from "../lib/amlCheck";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.post("/smart-agreements", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};
  const projectId = String(body.projectId ?? "").trim();
  const totalPiCommitted = parseInt(String(body.totalPiCommitted ?? "0"), 10);
  const milestones = Array.isArray(body.milestones) ? body.milestones : [];

  if (!projectId || !Number.isFinite(totalPiCommitted) || totalPiCommitted <= 0) {
    res.status(400).json({ error: "projectId and totalPiCommitted > 0 required" }); return;
  }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, projectId));
  if (!pitch) { res.status(404).json({ error: "Project not found" }); return; }

  const amlResult = await runAmlCheck(meId, totalPiCommitted, projectId);
  if (amlResult.blocked) {
    res.status(403).json({ error: amlResult.reason, code: "AML_BLOCKED" }); return;
  }

  const terms = {
    projectId,
    senderId: meId,
    receiverId: pitch.founderId,
    amount: totalPiCommitted,
    milestones: milestones.map((m: { title: string; percentage: number }) => ({ title: m.title, percentage: m.percentage })),
    timestamp: new Date().toISOString(),
  };
  const termsHash = hashTerms(terms);

  const refundDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const id = uid("sa");
  await db.insert(smartAgreementsTable).values({
    id,
    senderId: meId,
    receiverId: pitch.founderId,
    projectId,
    totalPiCommitted,
    termsHash,
    status: "LOCKED_IN_ESCROW",
    refundDeadline,
  });

  let milestonesInserted = 0;
  if (milestones.length > 0) {
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title || !m.percentage) continue;
      await db.insert(milestonesTable).values({
        id: uid("ms"),
        proposalId: id,
        pitchId: projectId,
        title: String(m.title).trim(),
        description: String(m.description ?? "").trim(),
        percentageOfFunds: parseInt(String(m.percentage), 10),
        status: "locked",
        order: i,
      });
      milestonesInserted++;
    }
  }

  await db.insert(auditLogsTable).values({
    id: uid("al"),
    entityType: "smart_agreement",
    entityId: id,
    actorId: meId,
    action: "CREATED",
    metadata: JSON.stringify({ totalPiCommitted, termsHash, milestoneCount: milestonesInserted }),
  });

  await createNotification({
    userId: pitch.founderId,
    type: "pitch_backed",
    actorId: meId,
    pitchId: projectId,
    amount: totalPiCommitted,
    message: `initiated a smart escrow contract for ${pitch.title} (${totalPiCommitted.toLocaleString()} π)`,
  });

  res.status(201).json({
    id,
    status: "LOCKED_IN_ESCROW",
    termsHash,
    refundDeadline: refundDeadline.toISOString(),
    milestonesCreated: milestonesInserted,
    message: "Smart agreement created. Funds are held in escrow until milestones are completed and verified.",
  });
});

router.get("/smart-agreements/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, id));
  if (!agreement) { res.status(404).json({ error: "Not found" }); return; }
  if (agreement.senderId !== meId && agreement.receiverId !== meId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.proposalId, id)).orderBy(milestonesTable.order);
  const documents = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.agreementId, id));
  const logs = await db.select().from(auditLogsTable).where(eq(auditLogsTable.entityId, id)).orderBy(desc(auditLogsTable.createdAt));

  res.json({ ...agreement, milestones, documents, auditLog: logs });
});

router.post("/smart-agreements/:id/documents", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, id));
  if (!agreement) { res.status(404).json({ error: "Not found" }); return; }
  if (agreement.receiverId !== meId) { res.status(403).json({ error: "Only the project founder can submit proof documents" }); return; }

  const documentUrl = String(req.body?.documentUrl ?? "").trim();
  const documentType = String(req.body?.documentType ?? "proof").trim();
  if (!documentUrl) { res.status(400).json({ error: "documentUrl required" }); return; }

  const docId = uid("doc");
  await db.insert(projectDocumentsTable).values({ id: docId, projectId: agreement.projectId, agreementId: id, documentUrl, documentType, status: "PENDING" });
  await db.insert(auditLogsTable).values({
    id: uid("al"),
    entityType: "smart_agreement",
    entityId: id,
    actorId: meId,
    action: "DOCUMENT_SUBMITTED",
    metadata: JSON.stringify({ documentType, documentUrl }),
  });

  const [doc] = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.id, docId));
  res.status(201).json(doc);
});

export default router;
