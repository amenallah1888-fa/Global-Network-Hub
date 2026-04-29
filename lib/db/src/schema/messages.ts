import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id").notNull(),
    text: text("text").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    fromIdx: index("messages_from_idx").on(t.fromUserId),
    toIdx: index("messages_to_idx").on(t.toUserId),
    pairIdx: index("messages_pair_idx").on(t.fromUserId, t.toUserId),
  }),
);

export type Message = typeof messagesTable.$inferSelect;
