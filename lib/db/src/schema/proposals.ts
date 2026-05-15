import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const proposalsTable = pgTable("proposals", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id").notNull(),
  investorId: text("investor_id").notNull(),
  type: text("type").notNull().default("donation"),
  amountPi: integer("amount_pi").notNull().default(0),
  equityPct: integer("equity_pct").notNull().default(0),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

export type Proposal = typeof proposalsTable.$inferSelect;
