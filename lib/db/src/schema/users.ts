import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  title: text("title").notNull().default(""),
  company: text("company").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  avatarKey: text("avatar_key").notNull().default("avatar1"),
  verified: boolean("verified").notNull().default(false),
  followersCount: integer("followers_count").notNull().default(0),
  bio: text("bio").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  passwordHash: text("password_hash"),
  piUid: text("pi_uid").unique(),
  role: text("role").notNull().default("user"),
});

export type User = typeof usersTable.$inferSelect;
