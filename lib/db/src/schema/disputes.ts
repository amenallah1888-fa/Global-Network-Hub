import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const disputesTable = pgTable("disputes", {
  id: text("id").primaryKey(),
  agreementId: text("agreement_id").notNull(),
  raisedBy: text("raised_by").notNull(),
  reason: text("reason").notNull().default(""),
  phase: text("phase").notNull().default("timelock"),
  status: text("status").notNull().default("open"),
  aiSummary: text("ai_summary"),
  aiRecommendation: text("ai_recommendation"),
  timelockExpiresAt: timestamp("timelock_expires_at", { withTimezone: true }),
  juryDeadline: timestamp("jury_deadline", { withTimezone: true }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const juryVotesTable = pgTable("jury_votes", {
  id: text("id").primaryKey(),
  disputeId: text("dispute_id").notNull(),
  jurorId: text("juror_id").notNull(),
  vote: text("vote").notNull(),
  reasoning: text("reasoning").notNull().default(""),
  rewarded: boolean("rewarded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reputationEventsTable = pgTable("reputation_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  delta: integer("delta").notNull().default(0),
  reason: text("reason").notNull().default(""),
  refId: text("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Dispute = typeof disputesTable.$inferSelect;
export type JuryVote = typeof juryVotesTable.$inferSelect;
export type ReputationEvent = typeof reputationEventsTable.$inferSelect;
