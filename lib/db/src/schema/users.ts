import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  email: text("email"),
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
  accountStatus: text("account_status").notNull().default("active"),
  kycStatus: text("kyc_status").notNull().default("none"),
  kycVerifiedAt: timestamp("kyc_verified_at", { withTimezone: true }),
  reputationScore: integer("reputation_score").notNull().default(0),
  locale: text("locale").notNull().default("en"),
  piWalletAddress: text("pi_wallet_address"),
  isProfilePublic: boolean("is_profile_public").notNull().default(true),
});

export type User = typeof usersTable.$inferSelect;
