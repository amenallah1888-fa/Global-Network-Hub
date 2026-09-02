import { and, eq, lt, sql } from "drizzle-orm";
import { db, milestonesTable, smartAgreementsTable, auditLogsTable, userAvatarsTable } from "@workspace/db";
import { addReputationEvent } from "./reputation";
import { awardXp } from "./xpEngine";
import { auditLogValues } from "./auditLog";

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
    const released = await db.transaction(async (tx) => {
      const [lockedMilestone] = await tx.select().from(milestonesTable).where(
        and(
          eq(milestonesTable.id, m.id),
          eq(milestonesTable.status, "pending_proof"),
          lt(milestonesTable.timelockAutoReleaseAt, now),
        ),
      ).for("update");
      if (!lockedMilestone) return null;
      await tx.update(milestonesTable)
        .set({ status: "released", completedAt: now })
        .where(eq(milestonesTable.id, lockedMilestone.id));
      await tx.insert(auditLogsTable).values(auditLogValues({
        entityType: "milestone",
        entityId: lockedMilestone.id,
        actorId: "system",
        action: "TIMELOCK_AUTO_RELEASED",
        metadata: { reason: "Client did not respond within timelock window", pitchId: lockedMilestone.pitchId },
      }));
      return lockedMilestone;
    });

    if (!released) continue;
    const [agreement] = await db.select().from(smartAgreementsTable).where(eq(smartAgreementsTable.projectId, released.pitchId));
    if (agreement) {
      await addReputationEvent(agreement.receiverId, "milestone_delivered", `Milestone "${released.title}" auto-released by timelock`, released.id);
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
    const completed = await db.transaction(async (tx) => {
      const [lockedAgreement] = await tx.select().from(smartAgreementsTable).where(
        and(
          eq(smartAgreementsTable.id, sa.id),
          eq(smartAgreementsTable.status, "LOCKED_IN_ESCROW"),
          lt(smartAgreementsTable.refundDeadline, now),
        ),
      ).for("update");
      if (!lockedAgreement) return null;
      const allMilestones = await tx.select().from(milestonesTable).where(eq(milestonesTable.proposalId, lockedAgreement.id));
      if (allMilestones.length === 0 || !allMilestones.every((milestone) => milestone.status === "released")) return null;
      await tx.update(smartAgreementsTable)
        .set({ status: "ACTIVE", completedAt: now, updatedAt: now })
        .where(eq(smartAgreementsTable.id, lockedAgreement.id));
      await tx.insert(auditLogsTable).values(auditLogValues({
        entityType: "financial",
        entityId: lockedAgreement.id,
        actorId: "system",
        action: "ESCROW_COMPLETED",
        metadata: { projectId: lockedAgreement.projectId, totalPiCommitted: lockedAgreement.totalPiCommitted },
      }));
      return lockedAgreement;
    });

    if (completed) {
      await addReputationEvent(completed.receiverId, "escrow_completed", `Agreement ${completed.id} completed`, completed.id);
      await addReputationEvent(completed.senderId, "escrow_completed", `Agreement ${completed.id} funded`, completed.id);
      await awardXp(completed.receiverId, "escrow_completed");
      await awardXp(completed.senderId, "escrow_completed");
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
    await db.transaction(async (tx) => {
      const [lockedAvatar] = await tx.select().from(userAvatarsTable).where(
        and(eq(userAvatarsTable.id, av.id), eq(userAvatarsTable.decayActive, false)),
      ).for("update");
      if (!lockedAvatar || lockedAvatar.xp <= 0) return;
      const decayAmount = Math.max(1, Math.floor(lockedAvatar.xp * DECAY_XP_PCT / 100));
      const newXp = Math.max(0, lockedAvatar.xp - decayAmount);
      await tx.update(userAvatarsTable).set({
        xp: newXp,
        decayActive: true,
        dailyStreak: 0,
        updatedAt: new Date(),
      }).where(eq(userAvatarsTable.id, lockedAvatar.id));
      await tx.insert(auditLogsTable).values(auditLogValues({
        entityType: "avatar",
        entityId: lockedAvatar.id,
        actorId: "system",
        action: "XP_DECAY",
        metadata: { userId: lockedAvatar.userId, decayAmount, newXp, reason: `${DECAY_INACTIVE_DAYS} days of inactivity` },
      }));
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
