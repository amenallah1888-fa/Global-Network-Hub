import { pgTable, text, doublePrecision } from "drizzle-orm/pg-core";

export const markersTable = pgTable("markers", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  city: text("city").notNull(),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  meta: text("meta").notNull().default(""),
  refId: text("ref_id"),
});

export type Marker = typeof markersTable.$inferSelect;
