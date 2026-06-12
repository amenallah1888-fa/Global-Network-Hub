import { and, eq, lt, sql } from "drizzle-orm";
import { db, milestonesTable, smartAgreementsTable, auditLogsTable, userAvatarsTable } from "@workspace/db";
import { addReputationEvent } from "./reputation";
import { awardXp } from "./xpEngine";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const DECAY_INACTIVE_DAYS = 7;
const DECAY_XP_PCT = 5;

async function processTimelockMilestones() {
  const now = new Date();

  const expired = await db.select().from(milestonesTable).where(
    and(
      eq(milestonesTable.status, "pending_proof"),
      lt(milestonesTable.timelockAutoReleaseAt, now)
    )
  );

  for (const m of expired) {
    await db.update(milestonesTable)
      .set({ status: "released", completedAt: now })
      .where(eq(milestonesTable.id, m.id));

    await db.insert(auditLogsTable).values({
      id: uid("al"),
      entityType: "milestone",
      entityId: m.id,
      actorId: "system",
      action: "TIMELOCK_AUTO_RELEASED",
      metadata: JSON.stringify({ reason: "Client did not respond within timelock window", pitchId: m.pitchId }),
    });

    const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.projectId, m.pitchId));
    if (agreement) {
      await addReputationEvent(agreement.receiverId, "milestone_delivered", `Milestone "${m.title}" auto-released by timelock`, m.id);
      await awardXp(agreement.receiverId, "milestone_completed");
    }
  }

  const refundExpired = await db.select().from(smartAgreementsTable).where(
    and(
      eq(smartAgreementsTable.status, "LOCKED_IN_ESCROW"),
      lt(smartAgreementsTable.refundDeadline, now)
    )
  );

  for (const sa of refundExpired) {
    const allMilestones = await db.select().from(milestonesTable).where(eq(milestonesTable.proposalId, sa.id));
    const allReleased = allMilestones.length > 0 && allMilestones.every((m) => m.status === "released");
    if (allReleased) {
      await db.update(smartAgreementsTable)
        .set({ status: "ACTIVE", completedAt: now, updatedAt: now })
        .where(eq(smartAgreementsTable.id, sa.id));

      await addReputationEvent(sa.receiverId, "escrow_completed", `Agreement ${sa.id} completed`, sa.id);
      await addReputationEvent(sa.senderId, "escrow_completed", `Agreement ${sa.id} funded`, sa.id);
      await awardXp(sa.receiverId, "escrow_completed");
      await awardXp(sa.senderId, "escrow_completed");
    }
  }
}

async function processDecay() {
  const cutoff = new Date(Date.now() - DECAY_INACTIVE_DAYS * 86400 * 1000);

  const inactive = await db.select().from(userAvatarsTable).where(
    and(
      lt(userAvatarsTable.lastActivityAt, cutoff),
      eq(userAvatarsTable.decayActive, false)
    )
  );

  for (const av of inactive) {
    if (av.xp <= 0) continue;
    const decayAmount = Math.max(1, Math.floor(av.xp * DECAY_XP_PCT / 100));
    const newXp = Math.max(0, av.xp - decayAmount);

    await db.update(userAvatarsTable).set({
      xp: newXp,
      decayActive: true,
      dailyStreak: 0,
      updatedAt: new Date(),
    }).where(eq(userAvatarsTable.id, av.id));

    await db.insert(auditLogsTable).values({
      id: uid("al"),
      entityType: "avatar",
      entityId: av.id,
      actorId: "system",
      action: "XP_DECAY",
      metadata: JSON.stringify({ userId: av.userId, decayAmount, newXp, reason: `${DECAY_INACTIVE_DAYS} days of inactivity` }),
    });
  }
}

let timelockInterval: ReturnType<typeof setInterval> | null = null;
let decayInterval: ReturnType<typeof setInterval> | null = null;

export function startTimelockWorker() {
  if (timelockInterval) return;

  timelockInterval = setInterval(async () => {
    try { await processTimelockMilestones(); } catch (e) {
      console.error("[timelockWorker] milestone error:", e);
    }
  }, 60_000);

  decayInterval = setInterval(async () => {
    try { await processDecay(); } catch (e) {
      console.error("[timelockWorker] decay error:", e);
    }
  }, 6 * 3600 * 1000);

  console.log("[timelockWorker] started — milestones every 60s, decay every 6h");
}

export function stopTimelockWorker() {
  if (timelockInterval) { clearInterval(timelockInterval); timelockInterval = null; }
  if (decayInterval) { clearInterval(decayInterval); decayInterval = null; }
}
