import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const postsTable = pgTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  text: text("text").notNull(),
  imageKey: text("image_key"),
  sponsored: boolean("sponsored").notNull().default(false),
  sponsorLabel: text("sponsor_label"),
  category: text("category").notNull().default("general"),
  likesCount: integer("likes_count").notNull().default(0),
  retweetsCount: integer("retweets_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  tipsTotal: integer("tips_total").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Post = typeof postsTable.$inferSelect;
