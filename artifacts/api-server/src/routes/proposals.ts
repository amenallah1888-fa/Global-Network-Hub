import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  proposalsTable,
  pitchesTable,
  pitchBackersTable,
  usersTable,
  transactionsTable,
  circlesTable,
  circleMembersTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";
import { awardXp } from "../lib/xpEngine";
import { addReputationEvent } from "../lib/reputation";
import { getPagination } from "../lib/requestSecurity";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.post("/pitches/:id/proposals", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const pitchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, pitchId));
  if (!pitch) { res.status(404).json({ error: "Pitch not found" }); return; }
  if (pitch.founderId === meId) { res.status(400).json({ error: "Cannot invest in your own pitch" }); return; }

  const parsed = z.object({
    type: z.enum(["investment", "donation"]).default("donation"),
    amountPi: z.coerce.number().int().positive().max(1_000_000_000),
    equityPct: z.coerce.number().int().min(0).max(100).default(0),
    message: z.string().trim().max(500).default(""),
  }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid proposal payload", code: "INVALID_REQUEST" }); return; }
  const type = parsed.data.type;
  const amountPi = parsed.data.amountPi;
  const equityPct = type === "investment" ? parsed.data.equityPct : 0;
  const message = parsed.data.message;

  const proposalId = uid("prop");
  await db.insert(proposalsTable).values({
    id: proposalId,
    pitchId,
    investorId: meId,
    type,
    amountPi,
    equityPct,
    message,
    status: "pending",
  });

  await createNotification({
    userId: pitch.founderId,
    type: "proposal_received",
    actorId: meId,
    pitchId,
    amount: amountPi,
    message: type === "investment"
      ? `sent an investment offer of ${amountPi} π for ${equityPct}% equity on "${pitch.title}"`
      : `sent a donation offer of ${amountPi} π to "${pitch.title}"`,
  });

  const [created] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, proposalId));
  res.status(201).json(created);
});

router.get("/pitches/:id/proposals", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const pitchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, pitchId));
  if (!pitch) { res.status(404).json({ error: "Not found" }); return; }
  if (pitch.founderId !== meId) { res.status(403).json({ error: "Only the founder can view proposals" }); return; }

  const proposals = await db.select().from(proposalsTable)
    .where(and(eq(proposalsTable.pitchId, pitchId), eq(proposalsTable.status, "pending")))
    .orderBy(desc(proposalsTable.createdAt)).limit(limit).offset(offset);

  const userIds = [...new Set(proposals.map((p) => p.investorId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}`), sql`, `)}])`)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(proposals.map((p) => ({ ...p, investor: userMap.get(p.investorId) ?? null })));
});

router.get("/proposals/mine", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const { limit, offset } = getPagination(res);
  const proposals = await db.select().from(proposalsTable)
    .where(eq(proposalsTable.investorId, meId))
    .orderBy(desc(proposalsTable.createdAt)).limit(limit).offset(offset);
  res.json(proposals);
});

router.post("/proposals/:id/accept", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const proposalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, proposalId));
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }
  if (proposal.status !== "pending") { res.status(400).json({ error: "Proposal is no longer pending" }); return; }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, proposal.pitchId));
  if (!pitch) { res.status(404).json({ error: "Pitch not found" }); return; }
  if (pitch.founderId !== meId) { res.status(403).json({ error: "Only the founder can accept offers" }); return; }

  const txId = uid("tx");
  await db.transaction(async (tx) => {
    await tx.update(proposalsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(proposalsTable.id, proposalId));
    await tx.update(pitchesTable)
      .set({ raised: sql`${pitchesTable.raised} + ${proposal.amountPi}` })
      .where(eq(pitchesTable.id, proposal.pitchId));
    const existing = await tx.select().from(pitchBackersTable)
      .where(and(eq(pitchBackersTable.pitchId, proposal.pitchId), eq(pitchBackersTable.userId, proposal.investorId)));
    if (existing.length === 0) {
      await tx.insert(pitchBackersTable).values({ pitchId: proposal.pitchId, userId: proposal.investorId });
      await tx.update(pitchesTable)
        .set({ backersCount: sql`${pitchesTable.backersCount} + 1` })
        .where(eq(pitchesTable.id, proposal.pitchId));
    }
    await tx.insert(transactionsTable).values({
      id: txId,
      userId: proposal.investorId,
      fromUserId: proposal.investorId,
      toUserId: meId,
      pitchId: proposal.pitchId,
      amount: proposal.amountPi,
      type: proposal.type === "investment" ? "investment" : "donation",
      status: "completed",
      note: proposal.type === "investment"
        ? `Investment in "${pitch.title}" for ${proposal.equityPct}% equity`
        : `Donation to "${pitch.title}"`,
    });
    const circles = await tx.select().from(circlesTable)
      .where(sql`${proposal.pitchId} = ANY(${circlesTable.founderIds})`);
    const pitchPrivateCircle = circles.find((c) => c.founderIds.includes(pitch.founderId) && c.inviteOnly);
    if (pitchPrivateCircle) {
      const alreadyMember = await tx.select().from(circleMembersTable)
        .where(and(eq(circleMembersTable.circleId, pitchPrivateCircle.id), eq(circleMembersTable.userId, proposal.investorId)));
      if (alreadyMember.length === 0) {
        await tx.insert(circleMembersTable).values({ circleId: pitchPrivateCircle.id, userId: proposal.investorId, paid: false, role: "member" });
        await tx.update(circlesTable)
          .set({ membersCount: sql`${circlesTable.membersCount} + 1` })
          .where(eq(circlesTable.id, pitchPrivateCircle.id));
      }
    }
  });

  await createNotification({
    userId: proposal.investorId,
    type: "proposal_accepted",
    actorId: meId,
    pitchId: proposal.pitchId,
    amount: proposal.amountPi,
    message: `accepted your ${proposal.type === "investment" ? "investment" : "donation"} offer of ${proposal.amountPi} π on "${pitch.title}"`,
  });

  if (proposal.type === "investment") {
    await awardXp(proposal.investorId, "pi_invested", { piAmount: proposal.amountPi });
    if (proposal.amountPi >= 100) await awardXp(proposal.investorId, "escrow_high_value");
    await addReputationEvent(proposal.investorId, "escrow_completed", `Backed "${pitch.title}" with ${proposal.amountPi} π`, txId);
  }

  res.json({ accepted: true, pitchTitle: pitch.title });
});

router.post("/proposals/:id/decline", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const proposalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, proposalId));
  if (!proposal) { res.status(404).json({ error: "Not found" }); return; }
  if (proposal.status !== "pending") { res.status(400).json({ error: "Proposal is no longer pending" }); return; }

  const [pitch] = await db.select().from(pitchesTable).where(eq(pitchesTable.id, proposal.pitchId));
  if (!pitch) { res.status(404).json({ error: "Pitch not found" }); return; }
  if (pitch.founderId !== meId) { res.status(403).json({ error: "Only the founder can decline offers" }); return; }

  await db.update(proposalsTable)
    .set({ status: "declined", respondedAt: new Date() })
    .where(eq(proposalsTable.id, proposalId));

  await createNotification({
    userId: proposal.investorId,
    type: "proposal_declined",
    actorId: meId,
    pitchId: proposal.pitchId,
    message: `declined your offer on "${pitch.title}"`,
  });

  res.json({ declined: true });
});

export default router;
