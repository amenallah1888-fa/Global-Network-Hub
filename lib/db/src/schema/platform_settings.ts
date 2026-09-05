import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const platformSettingsTable = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  escrowFeePercent: numeric("escrow_fee_percent", { precision: 8, scale: 2 }).notNull().default("3.00"),
  withdrawalFlatFee: numeric("withdrawal_flat_fee", { precision: 18, scale: 2 }).notNull().default("1.00"),
  featuredPitchFee: numeric("featured_pitch_fee", { precision: 18, scale: 2 }).notNull().default("10.00"),
  kycVerificationFee: numeric("kyc_verification_fee", { precision: 18, scale: 2 }).notNull().default("5.00"),
  nftRoyaltyFeePercent: numeric("nft_royalty_fee_percent", { precision: 8, scale: 2 }).notNull().default("2.50"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformSettings = typeof platformSettingsTable.$inferSelect;