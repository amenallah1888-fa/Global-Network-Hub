import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const circlesTable = pgTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  about: text("about").notNull(),
  category: text("category").notNull().default("General"),
  color: text("color").notNull().default("#D4AF7A"),
  coverKey: text("cover_key"),
  paid: boolean("paid").notNull().default(false),
  price: integer("price").notNull().default(0),
  membersCount: integer("members_count").notNull().default(0),
  activeNow: integer("active_now").notNull().default(0),
  founderIds: text("founder_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const circleMembersTable = pgTable(
  "circle_members",
  {
    circleId: text("circle_id").notNull(),
    userId: text("user_id").notNull(),
    paid: boolean("paid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.userId] })],
);

export type Circle = typeof circlesTable.$inferSelect;
