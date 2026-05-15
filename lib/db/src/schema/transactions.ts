import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  pitchId: text("pitch_id").notNull(),
  amount: integer("amount").notNull().default(0),
  type: text("type").notNull().default("invest"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Transaction = typeof transactionsTable.$inferSelect;
