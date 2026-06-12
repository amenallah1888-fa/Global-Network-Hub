import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const userAvatarsTable = pgTable("user_avatars", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentSkinId: text("current_skin_id").notNull().default("skin_default"),
  path: text("path").notNull().default("none"),
  dailyStreak: integer("daily_streak").notNull().default(0),
  lastLoginDate: text("last_login_date"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  decayActive: boolean("decay_active").notNull().default(false),
  mintStatus: text("mint_status").notNull().default("none"),
  mintedAt: timestamp("minted_at", { withTimezone: true }),
  nftTokenId: text("nft_token_id"),
  totalPiInvested: integer("total_pi_invested").notNull().default(0),
  pitchesLaunched: integer("pitches_launched").notNull().default(0),
  milestonesCompleted: integer("milestones_completed").notNull().default(0),
  capsulesPosted: integer("capsules_posted").notNull().default(0),
  escrowsCompleted: integer("escrows_completed").notNull().default(0),
  consecutiveFiveStarReviews: integer("consecutive_five_star_reviews").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const avatarSkinsTable = pgTable("avatar_skins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  assetPath: text("asset_path").notNull(),
  tier: text("tier").notNull().default("common"),
  path: text("path").notNull().default("any"),
  minLevel: integer("min_level").notNull().default(1),
  unlockCondition: text("unlock_condition").notNull().default(""),
  isPremium: boolean("is_premium").notNull().default(false),
  isNftEligible: boolean("is_nft_eligible").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const userUnlockedSkinsTable = pgTable("user_unlocked_skins", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  skinId: text("skin_id").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  equipped: boolean("equipped").notNull().default(false),
});

export const nftListingsTable = pgTable("nft_listings", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull(),
  avatarId: text("avatar_id").notNull(),
  pricePi: integer("price_pi").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  buyerId: text("buyer_id"),
});

export const nftTransactionsTable = pgTable("nft_transactions", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  sellerId: text("seller_id").notNull(),
  buyerId: text("buyer_id").notNull(),
  avatarId: text("avatar_id").notNull(),
  pricePi: integer("price_pi").notNull().default(0),
  royaltyPi: integer("royalty_pi").notNull().default(0),
  royaltyPct: integer("royalty_pct").notNull().default(25),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectCapsulesTable = pgTable("project_capsules", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id").notNull(),
  founderId: text("founder_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  videoUrl: text("video_url"),
  codeLogUrl: text("code_log_url"),
  weekNumber: integer("week_number").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserAvatar = typeof userAvatarsTable.$inferSelect;
export type AvatarSkin = typeof avatarSkinsTable.$inferSelect;
export type UserUnlockedSkin = typeof userUnlockedSkinsTable.$inferSelect;
export type NftListing = typeof nftListingsTable.$inferSelect;
export type NftTransaction = typeof nftTransactionsTable.$inferSelect;
export type ProjectCapsule = typeof projectCapsulesTable.$inferSelect;
