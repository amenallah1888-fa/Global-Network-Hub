import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const amlFlagsTable = pgTable("aml_flags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  pitchId: text("pitch_id"),
  totalAmount: integer("total_amount").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  flagReason: text("flag_reason").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  frozen: boolean("frozen").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AmlFlag = typeof amlFlagsTable.$inferSelect;
