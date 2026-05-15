import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  text: text("text").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DmMessage = typeof messagesTable.$inferSelect;
