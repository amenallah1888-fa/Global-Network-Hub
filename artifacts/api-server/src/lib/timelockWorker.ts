import { and, eq, lt, sql } from "drizzle-orm";
import { db, milestonesTable, smartAgreementsTable, auditLogsTable } from "@workspace/db";
import { addReputationEvent } from "./reputation";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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
    }
  }
}

let timelockInterval: ReturnType<typeof setInterval> | null = null;

export function startTimelockWorker() {
  if (timelockInterval) return;
  timelockInterval = setInterval(async () => {
    try { await processTimelockMilestones(); } catch (e) {
      console.error("[timelockWorker] error:", e);
    }
  }, 60_000);
  console.log("[timelockWorker] started — checking every 60s");
}

export function stopTimelockWorker() {
  if (timelockInterval) { clearInterval(timelockInterval); timelockInterval = null; }
}
