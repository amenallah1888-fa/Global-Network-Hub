import { pgTable, text, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";

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
  userId: text("user_id"),
  ipAddress: text("ip_address"),
  details: jsonb("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_created_at_idx").on(table.createdAt),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
]);

export type Milestone = typeof milestonesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
