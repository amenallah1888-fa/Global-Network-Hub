import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const pitchesTable = pgTable("pitches", {
  id: text("id").primaryKey(),
  founderId: text("founder_id").notNull(),
  title: text("title").notNull(),
  stage: text("stage").notNull(),
  industry: text("industry").notNull(),
  raising: integer("raising").notNull(),
  raised: integer("raised").notNull().default(0),
  city: text("city").notNull(),
  summary: text("summary").notNull(),
  coverKey: text("cover_key"),
  backersCount: integer("backers_count").notNull().default(0),
  trending: boolean("trending").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pitchBackersTable = pgTable(
  "pitch_backers",
  {
    pitchId: text("pitch_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.pitchId, t.userId] })],
);

export type Pitch = typeof pitchesTable.$inferSelect;
