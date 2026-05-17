import { pgTable, text, integer, timestamp, real } from "drizzle-orm/pg-core";

export const serviceAppsTable = pgTable("service_apps", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  pricePi: integer("price_pi").notNull().default(0),
  rating: real("rating").notNull().default(0),
  trustScore: integer("trust_score").notNull().default(0),
  city: text("city"),
  country: text("country"),
  portfolioUrl: text("portfolio_url"),
  hiredCount: integer("hired_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ServiceApp = typeof serviceAppsTable.$inferSelect;
