import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const commentsTable = pgTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  authorId: text("author_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Comment = typeof commentsTable.$inferSelect;
