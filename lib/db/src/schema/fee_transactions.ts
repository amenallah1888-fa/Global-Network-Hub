import { pgTable, text, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const feeTransactionsTable = pgTable("fee_transactions", {
  id: text("id").primaryKey(),
  sourceTransactionId: text("source_transaction_id").notNull(),
  feeType: text("fee_type").notNull(),
  grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
  feeAmount: numeric("fee_amount", { precision: 18, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PI"),
  status: text("status").notNull().default("recorded"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("fee_transactions_created_at_idx").on(table.createdAt),
  index("fee_transactions_type_idx").on(table.feeType),
  index("fee_transactions_source_idx").on(table.sourceTransactionId),
]);

export type FeeTransaction = typeof feeTransactionsTable.$inferSelect;