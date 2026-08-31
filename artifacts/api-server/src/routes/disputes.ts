import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, disputesTable, juryVotesTable, smartAgreementsTable, auditLogsTable,
  usersTable, messagesTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { addReputationEvent } from "../lib/reputation";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const TIMELOCK_HOURS = 24;
const JURY_HOURS = 72;
const JURY_SIZE = 5;
const MIN_REPUTATION_FOR_JURY = 10;

router.post("/smart-agreements/:id/dispute", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reason = String(req.body?.reason ?? "").trim();

  if (!reason) { res.status(400).json({ error: "Dispute reason required" }); return; }

  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, id));
  if (!agreement) { res.status(404).json({ error: "Agreement not found" }); return; }
  if (agreement.senderId !== meId && agreement.receiverId !== meId) {
    res.status(403).json({ error: "You are not a party to this agreement" }); return;
  }
  if (agreement.disputeStatus) {
    res.status(409).json({ error: "A dispute is already open for this agreement" }); return;
  }

  const timelockExpiresAt = new Date(Date.now() + TIMELOCK_HOURS * 3600 * 1000);
  const disputeId = uid("dis");

  await db.insert(disputesTable).values({
    id: disputeId,
    agreementId: id,
    raisedBy: meId,
    reason,
    phase: "timelock",
    status: "open",
    timelockExpiresAt,
  });

  await db.update(smartAgreementsTable)
    .set({ disputeStatus: "open", timelockDeadline: timelockExpiresAt, updatedAt: new Date() })
    .where(eq(smartAgreementsTable.id, id));

  await db.insert(auditLogsTable).values({
    id: uid("al"), entityType: "dispute", entityId: disputeId, actorId: meId,
    action: "DISPUTE_OPENED", metadata: JSON.stringify({ reason, timelockExpiresAt }),
  });

  const otherParty = agreement.senderId === meId ? agreement.receiverId : agreement.senderId;
  await createNotification({
    userId: otherParty, type: "dispute_opened", actorId: meId,
    message: `opened a dispute on agreement ${id}: "${reason.slice(0, 80)}"`,
  });

  res.status(201).json({ disputeId, phase: "timelock", timelockExpiresAt, message: `The other party has ${TIMELOCK_HOURS}h to respond before AI analysis begins.` });
});

router.post("/disputes/:id/resolve", async (req, res): Promise<void> => {
  currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!dispute) { res.status(404).json({ error: "Dispute not found" }); return; }
  if (dispute.status !== "open") { res.status(400).json({ error: "Dispute is already resolved" }); return; }

  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, dispute.agreementId));
  if (!agreement) { res.status(404).json({ error: "Agreement not found" }); return; }

  const now = new Date();
  const timelockExpired = dispute.timelockExpiresAt && now > dispute.timelockExpiresAt;

  if (dispute.phase === "timelock" && timelockExpired) {
    const chatHistory = await db.select({ content: messagesTable.text, senderId: messagesTable.fromUserId })
      .from(messagesTable)
      .where(
        sql`(${messagesTable.fromUserId} = ${agreement.senderId} AND ${messagesTable.toUserId} = ${agreement.receiverId})
          OR (${messagesTable.fromUserId} = ${agreement.receiverId} AND ${messagesTable.toUserId} = ${agreement.senderId})`
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(30);

    const aiSummary = analyzeDispute(dispute.reason, chatHistory, agreement);
    const aiRecommendation = aiSummary.favoredParty;
    const juryDeadline = new Date(Date.now() + JURY_HOURS * 3600 * 1000);

    const jurors = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.kycStatus, "verified"),
        sql`${usersTable.reputationScore} >= ${MIN_REPUTATION_FOR_JURY}`,
        sql`${usersTable.id} != ${agreement.senderId}`,
        sql`${usersTable.id} != ${agreement.receiverId}`
      ))
      .limit(JURY_SIZE);

    await db.update(disputesTable).set({
      phase: "jury",
      aiSummary: aiSummary.summary,
      aiRecommendation,
      juryDeadline,
    }).where(eq(disputesTable.id, id));

    await db.update(smartAgreementsTable)
      .set({ juryDeadline, aiVerdict: aiRecommendation, updatedAt: new Date() })
      .where(eq(smartAgreementsTable.id, dispute.agreementId));

    for (const juror of jurors) {
      await createNotification({
        userId: juror.id, type: "jury_selected", actorId: "system",
        message: `You have been selected as a juror for dispute ${id}. Vote within ${JURY_HOURS}h.`,
      });
    }

    res.json({ phase: "jury", aiRecommendation: aiSummary.summary, juryDeadline, jurorCount: jurors.length });
    return;
  }

  if (dispute.phase === "jury") {
    const votes = await db.select().from(juryVotesTable).where(eq(juryVotesTable.disputeId, id));
    if (votes.length < 3) { res.status(400).json({ error: "Not enough jury votes yet (minimum 3 required)" }); return; }

    const tallyFor = votes.filter((v) => v.vote === agreement.senderId).length;
    const tallyAgainst = votes.filter((v) => v.vote === agreement.receiverId).length;
    const winner = tallyFor >= tallyAgainst ? agreement.senderId : agreement.receiverId;
    const resolution = `Jury verdict: ${tallyFor} vs ${tallyAgainst}. Winner: ${winner === agreement.senderId ? "Buyer" : "Seller"}`;

    await db.update(disputesTable).set({ status: "resolved", resolution, resolvedAt: now }).where(eq(disputesTable.id, id));
    await db.update(smartAgreementsTable).set({ disputeStatus: "resolved", updatedAt: new Date() }).where(eq(smartAgreementsTable.id, dispute.agreementId));

    const majority = votes.filter((v) => v.vote === winner);
    const minority = votes.filter((v) => v.vote !== winner);
    for (const v of majority) {
      await db.update(juryVotesTable).set({ rewarded: true }).where(eq(juryVotesTable.id, v.id));
      await addReputationEvent(v.jurorId, "jury_accurate_vote", `Accurate jury vote on dispute ${id}`, id);
    }
    for (const v of minority) {
      await addReputationEvent(v.jurorId, "jury_inaccurate_vote", `Inaccurate jury vote on dispute ${id}`, id);
    }

    const loser = winner === agreement.senderId ? agreement.receiverId : agreement.senderId;
    await addReputationEvent(winner, "escrow_dispute_won", `Won dispute ${id}`, id);
    await addReputationEvent(loser, "escrow_dispute_lost", `Lost dispute ${id}`, id);

    res.json({ resolution, winner, votes: votes.length });
    return;
  }

  res.status(400).json({ error: "Timelock has not expired yet. Please wait for the timelock window to pass." });
});

router.post("/disputes/:id/vote", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const vote = String(req.body?.vote ?? "").trim();
  const reasoning = String(req.body?.reasoning ?? "").trim();

  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!dispute) { res.status(404).json({ error: "Dispute not found" }); return; }
  if (dispute.phase !== "jury") { res.status(400).json({ error: "This dispute is not in the jury phase" }); return; }
  if (dispute.status !== "open") { res.status(400).json({ error: "Dispute is already resolved" }); return; }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  if (!me || me.kycStatus !== "verified") { res.status(403).json({ error: "KYC verification required to serve as a juror" }); return; }
  if (me.reputationScore < MIN_REPUTATION_FOR_JURY) {
    res.status(403).json({ error: `Minimum reputation score of ${MIN_REPUTATION_FOR_JURY} required to vote` }); return;
  }

  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, dispute.agreementId));
  if (!agreement) { res.status(404).json({ error: "Agreement not found" }); return; }
  if (agreement.senderId === meId || agreement.receiverId === meId) {
    res.status(403).json({ error: "Parties to the agreement cannot serve as jurors" }); return;
  }
  if (![agreement.senderId, agreement.receiverId].includes(vote)) {
    res.status(400).json({ error: "Vote must be the ID of one of the two parties" }); return;
  }

  const existing = await db.select().from(juryVotesTable).where(and(eq(juryVotesTable.disputeId, id), eq(juryVotesTable.jurorId, meId)));
  if (existing.length > 0) { res.status(409).json({ error: "You have already voted on this dispute" }); return; }

  const voteId = uid("jv");
  await db.insert(juryVotesTable).values({ id: voteId, disputeId: id, jurorId: meId, vote, reasoning });
  res.status(201).json({ voteId, message: "Vote recorded. Reward or penalty will be applied after verdict." });
});

router.get("/disputes/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!dispute) { res.status(404).json({ error: "Not found" }); return; }

  const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.id, dispute.agreementId));
  if (!agreement) { res.status(404).json({ error: "Agreement not found" }); return; }
  if (agreement.senderId !== meId && agreement.receiverId !== meId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const votes = await db.select({ vote: juryVotesTable.vote }).from(juryVotesTable).where(eq(juryVotesTable.disputeId, id));
  res.json({ ...dispute, voteCount: votes.length });
});

function analyzeDispute(
  reason: string,
  chatHistory: { content: string; senderId: string }[],
  agreement: { senderId: string; receiverId: string; totalPiCommitted: number }
): { summary: string; favoredParty: string } {
  const keywords = reason.toLowerCase();
  let buyerScore = 0;
  let sellerScore = 0;

  if (keywords.includes("not delivered") || keywords.includes("no work") || keywords.includes("incomplete")) sellerScore += 3;
  if (keywords.includes("delivered") || keywords.includes("completed") || keywords.includes("proof")) buyerScore += 3;
  if (keywords.includes("quality") || keywords.includes("wrong") || keywords.includes("different")) sellerScore += 2;
  if (keywords.includes("satisfied") || keywords.includes("late") || keywords.includes("delay")) buyerScore += 1;

  const recentMessages = chatHistory.slice(0, 10);
  for (const msg of recentMessages) {
    const text = msg.content.toLowerCase();
    if (msg.senderId === agreement.receiverId) {
      if (text.includes("delivered") || text.includes("done") || text.includes("completed")) buyerScore += 1;
      if (text.includes("sorry") || text.includes("delay") || text.includes("issue")) sellerScore += 1;
    }
  }

  const favoredParty = buyerScore > sellerScore ? agreement.senderId : agreement.receiverId;
  const summary = `AI analysis: Based on the dispute reason and ${recentMessages.length} recent chat messages, the evidence leans toward ${buyerScore > sellerScore ? "the buyer (refund)" : "the seller (release funds)"}. Buyer indicators: ${buyerScore}, Seller indicators: ${sellerScore}. A jury of KYC-verified users has been convened for a final decision.`;

  return { summary, favoredParty };
}

export default router;
