import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull().default("service"),
  transactionId: text("transaction_id").notNull().unique(),
  rating: integer("rating").notNull(),
  body: text("body").notNull().default(""),
  onChain: boolean("on_chain").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
