import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pitchUpdatesTable = pgTable("pitch_updates", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PitchUpdate = typeof pitchUpdatesTable.$inferSelect;
