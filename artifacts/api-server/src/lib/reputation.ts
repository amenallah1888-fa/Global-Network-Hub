import { eq, sql } from "drizzle-orm";
import { db, usersTable, reputationEventsTable } from "@workspace/db";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type ReputationEventType =
  | "escrow_completed"
  | "escrow_dispute_won"
  | "escrow_dispute_lost"
  | "review_received"
  | "milestone_delivered"
  | "kyc_verified"
  | "jury_accurate_vote"
  | "jury_inaccurate_vote";

const DELTA: Record<ReputationEventType, number> = {
  escrow_completed: 10,
  escrow_dispute_won: 5,
  escrow_dispute_lost: -10,
  review_received: 2,
  milestone_delivered: 3,
  kyc_verified: 15,
  jury_accurate_vote: 4,
  jury_inaccurate_vote: -3,
};

export async function addReputationEvent(
  userId: string,
  eventType: ReputationEventType,
  reason: string,
  refId?: string
): Promise<void> {
  const delta = DELTA[eventType] ?? 0;
  await db.insert(reputationEventsTable).values({
    id: uid("rep"),
    userId,
    eventType,
    delta,
    reason,
    refId: refId ?? null,
  });
  await db.update(usersTable)
    .set({ reputationScore: sql`GREATEST(0, ${usersTable.reputationScore} + ${delta})` })
    .where(eq(usersTable.id, userId));
}
