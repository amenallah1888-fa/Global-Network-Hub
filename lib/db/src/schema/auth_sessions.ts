import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authSessionsTable = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type AuthSession = typeof authSessionsTable.$inferSelect;