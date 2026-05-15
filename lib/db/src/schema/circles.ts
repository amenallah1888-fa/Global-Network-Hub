import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const circlesTable = pgTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  about: text("about").notNull(),
  category: text("category").notNull().default("General"),
  color: text("color").notNull().default("#D4AF7A"),
  coverKey: text("cover_key"),
  coverUrl: text("cover_url"),
  paid: boolean("paid").notNull().default(false),
  price: integer("price").notNull().default(0),
  inviteOnly: boolean("invite_only").notNull().default(false),
  rules: text("rules"),
  poolBalance: integer("pool_balance").notNull().default(0),
  membersCount: integer("members_count").notNull().default(0),
  activeNow: integer("active_now").notNull().default(0),
  founderIds: text("founder_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const circleMembersTable = pgTable(
  "circle_members",
  {
    circleId: text("circle_id").notNull(),
    userId: text("user_id").notNull(),
    paid: boolean("paid").notNull().default(false),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.userId] })],
);

export const circleJoinRequestsTable = pgTable(
  "circle_join_requests",
  {
    circleId: text("circle_id").notNull(),
    userId: text("user_id").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.userId] })],
);

export const circleAnnouncementsTable = pgTable("circle_announcements", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const circleChatMessagesTable = pgTable("circle_chat_messages", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const circleEventsTable = pgTable("circle_events", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull(),
  creatorId: text("creator_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Circle = typeof circlesTable.$inferSelect;
export type CircleMember = typeof circleMembersTable.$inferSelect;
export type CircleJoinRequest = typeof circleJoinRequestsTable.$inferSelect;
export type CircleAnnouncement = typeof circleAnnouncementsTable.$inferSelect;
export type CircleChatMessage = typeof circleChatMessagesTable.$inferSelect;
export type CircleEvent = typeof circleEventsTable.$inferSelect;
