import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const coFounderSessionsTable = pgTable("co_founder_sessions", {
  id: text("id").primaryKey(),
  founderId: text("founder_id").notNull(),
  pitchId: text("pitch_id"),
  status: text("status").notNull().default("draft"),
  messages: jsonb("messages").notNull().default([]),
  draftState: jsonb("draft_state").notNull().default({}),
  optimizedState: jsonb("optimized_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const milestoneAuditsTable = pgTable("milestone_audits", {
  id: text("id").primaryKey(),
  milestoneId: text("milestone_id").notNull(),
  pitchId: text("pitch_id").notNull(),
  proofUrl: text("proof_url"),
  proofText: text("proof_text"),
  confidenceScore: integer("confidence_score").notNull().default(0),
  summary: text("summary").notNull().default(""),
  flags: jsonb("flags").notNull().default([]),
  model: text("model").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoFounderSession = typeof coFounderSessionsTable.$inferSelect;
export type MilestoneAudit = typeof milestoneAuditsTable.$inferSelect;
