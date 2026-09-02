import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, smartAgreementsTable, projectDocumentsTable, pitchesTable, milestonesTable, auditLogsTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { hashTerms } from "../lib/piRpc";
import { runAmlCheck } from "../lib/amlCheck";
import { createNotification } from "../lib/notify";
import { getPagination } from "../lib/requestSecurity";
import { z } from "@workspace/api-zod";
import { requireRole } from "../middlewares/authMiddleware";
import { uploadRateLimiter } from "../lib/rateLimit";
import { auditLogValues } from "../lib/auditLog";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.post("/smart-agreements", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const parsed = z.object({
    projectId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    totalPiCommitted: z.coerce.number().int().positive().max(1_000_000_000),
    milestones: z.array(z.object({
      title: z.string().trim().min(1).max(160),
      percentage: z.coerce.number().int().positive().max(100),
      description: z.string().trim().max(5000).optional(),
    }).strict()).max(20).default([]),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "projectId and totalPiCommitted > 0 required" }); return;
  }
  const { projectId, totalPiCommitted, milestones } = parsed.data;

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
  let milestonesInserted = 0;
  await db.transaction(async (tx) => {
    await tx.insert(smartAgreementsTable).values({
      id,
      senderId: meId,
      receiverId: pitch.founderId,
      projectId,
      totalPiCommitted,
      termsHash,
      status: "LOCKED_IN_ESCROW",
      refundDeadline,
    });
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      await tx.insert(milestonesTable).values({
        id: uid("ms"),
        proposalId: id,
        pitchId: projectId,
        title: m.title,
        description: m.description ?? "",
        percentageOfFunds: m.percentage,
        status: "locked",
        order: i,
      });
      milestonesInserted++;
    }
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "financial",
      entityId: id,
      actorId: meId,
      action: "SMART_AGREEMENT_CREATED",
      metadata: { totalPiCommitted, termsHash, milestoneCount: milestonesInserted },
      req,
    }));
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

  const { limit, offset } = getPagination(res);
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.proposalId, id)).orderBy(milestonesTable.order).limit(limit).offset(offset);
  const documents = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.agreementId, id)).limit(limit).offset(offset);
  const logs = await db.select().from(auditLogsTable).where(eq(auditLogsTable.entityId, id)).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset);

  res.json({ ...agreement, milestones, documents, auditLog: logs });
});

router.post("/smart-agreements/:id/documents", uploadRateLimiter, async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, id));
  if (!agreement) { res.status(404).json({ error: "Not found" }); return; }
  if (agreement.receiverId !== meId) { res.status(403).json({ error: "Only the project founder can submit proof documents" }); return; }

  const documentUrl = String(req.body?.documentUrl ?? "").trim();
  const documentType = String(req.body?.documentType ?? "proof").trim();
  if (!documentUrl) { res.status(400).json({ error: "documentUrl required" }); return; }

  const docId = uid("doc");
  await db.transaction(async (tx) => {
    await tx.insert(projectDocumentsTable).values({ id: docId, projectId: agreement.projectId, agreementId: id, documentUrl, documentType, status: "PENDING" });
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "smart_agreement",
      entityId: id,
      actorId: meId,
      action: "DOCUMENT_SUBMITTED",
      metadata: { documentType, hasDocumentUrl: Boolean(documentUrl) },
      req,
    }));
  });

  const [doc] = await db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.id, docId));
  res.status(201).json(doc);
});

router.patch("/project-documents/:id", requireRole(["validator", "admin"]), async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const status = req.body?.status === "APPROVED" ? "APPROVED" : "REJECTED";
  const reviewNote = typeof req.body?.reviewNote === "string" ? req.body.reviewNote.trim() : null;
  let doc: typeof projectDocumentsTable.$inferSelect | undefined;
  await db.transaction(async (tx) => {
    const [lockedDoc] = await tx.select().from(projectDocumentsTable)
      .where(eq(projectDocumentsTable.id, id))
      .for("update");
    if (!lockedDoc) return;
    await tx.update(projectDocumentsTable)
      .set({ status, reviewNote: reviewNote || null })
      .where(eq(projectDocumentsTable.id, id));
    [doc] = await tx.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.id, id));
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "admin_action",
      entityId: id,
      actorId: meId,
      action: "PROJECT_DOCUMENT_REVIEWED",
      metadata: { status, hasReviewNote: Boolean(reviewNote) },
      req,
    }));
  });
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  res.json(doc);
});

router.get("/admin/pending", requireRole(["validator", "admin"]), async (req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const [pendingDocs, pendingPitches] = await Promise.all([
    db.select().from(projectDocumentsTable).where(eq(projectDocumentsTable.status, "PENDING")).orderBy(desc(projectDocumentsTable.uploadedAt)).limit(limit).offset(offset),
    db.select().from(pitchesTable).where(eq(pitchesTable.verificationStatus, "pending")).orderBy(desc(pitchesTable.createdAt)).limit(limit).offset(offset),
  ]);
  res.json({ documents: pendingDocs, pitches: pendingPitches });
});

export default router;
