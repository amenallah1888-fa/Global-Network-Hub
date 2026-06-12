import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const milestonesTable = pgTable("milestones", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull(),
  pitchId: text("pitch_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  percentageOfFunds: integer("percentage_of_funds").notNull().default(0),
  status: text("status").notNull().default("locked"),
  proofUrl: text("proof_url"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  order: integer("order").notNull().default(0),
  timelockDeadline: timestamp("timelock_deadline", { withTimezone: true }),
  timelockAutoReleaseAt: timestamp("timelock_auto_release_at", { withTimezone: true }),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Milestone = typeof milestonesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
