import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const appDirectoryTable = pgTable("app_directory", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull().default(""),
  logoUrl: text("logo_url"),
  platform: text("platform").notNull().default("Both"),
  verifiedLink: text("verified_link").notNull(),
  securityScore: integer("security_score").notNull().default(0),
  submissionStatus: text("submission_status").notNull().default("pending"),
  submittedBy: text("submitted_by").notNull(),
  category: text("category").notNull().default("DeFi"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppDirectory = typeof appDirectoryTable.$inferSelect;
