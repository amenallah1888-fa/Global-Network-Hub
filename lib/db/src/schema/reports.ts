import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const reportsTable = pgTable(
  "reports",
  {
    reporterId: text("reporter_id").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull().default("pitch"),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reporterId, t.targetId] })],
);

export type Report = typeof reportsTable.$inferSelect;
