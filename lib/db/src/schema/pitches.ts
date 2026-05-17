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

  entityType: text("entity_type").notNull().default("startup"),
  serviceCategory: text("service_category"),

  verificationStatus: text("verification_status").notNull().default("pending"),
  roadmapUrl: text("roadmap_url"),
  founderLinkedin: text("founder_linkedin"),
  proofOfRealityUrl: text("proof_of_reality_url"),
  portfolioUrl: text("portfolio_url"),
  experienceDescription: text("experience_description"),
  reportsCount: integer("reports_count").notNull().default(0),
  requirements: text("requirements"),
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
