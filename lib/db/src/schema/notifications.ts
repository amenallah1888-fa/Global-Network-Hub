import {
  pgTable,
  text,
  serial,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  actorId: text("actor_id"),
  postId: text("post_id"),
  circleId: text("circle_id"),
  pitchId: text("pitch_id"),
  amount: integer("amount"),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
