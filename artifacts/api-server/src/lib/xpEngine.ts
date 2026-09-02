import { and, desc, eq, sql } from "drizzle-orm";
import { db, userAvatarsTable, avatarSkinsTable, userUnlockedSkinsTable, usersTable } from "@workspace/db";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type XpEventType =
  | "daily_checkin"
  | "escrow_completed"
  | "escrow_high_value"
  | "review_5_star"
  | "five_consecutive_reviews"
  | "pitch_launched"
  | "milestone_completed"
  | "capsule_posted"
  | "circle_joined"
  | "pi_invested"
  | "streak_bonus"
  | "streak_30_day"
  | "jury_vote"
  | "validator_block_approved";

const XP_REWARDS: Record<XpEventType, number> = {
  daily_checkin: 5,
  escrow_completed: 50,
  escrow_high_value: 25,
  review_5_star: 25,
  five_consecutive_reviews: 100,
  pitch_launched: 30,
  milestone_completed: 20,
  capsule_posted: 15,
  circle_joined: 10,
  pi_invested: 0,
  streak_bonus: 5,
  streak_30_day: 200,
  jury_vote: 8,
  validator_block_approved: 30,
};

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];

export function computeLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

const SKIN_CATALOG: Array<{
  id: string; name: string; description: string; assetPath: string;
  tier: string; path: string; minLevel: number; unlockCondition: string;
  isPremium: boolean; isNftEligible: boolean; sortOrder: number;
}> = [
  { id: "skin_default", name: "Newcomer", description: "Your starting avatar", assetPath: "skins/skin_default.png", tier: "common", path: "any", minLevel: 1, unlockCondition: "default", isPremium: false, isNftEligible: false, sortOrder: 0 },
  { id: "skin_builder_1", name: "Builder I", description: "First escrow completed", assetPath: "skins/skin_builder_1.png", tier: "uncommon", path: "builder", minLevel: 2, unlockCondition: "escrows_completed:1", isPremium: false, isNftEligible: false, sortOrder: 10 },
  { id: "skin_builder_pro", name: "Builder Pro", description: "5 consecutive 5-star reviews", assetPath: "skins/skin_builder_pro.png", tier: "rare", path: "builder", minLevel: 4, unlockCondition: "consecutive_five_star_reviews:5", isPremium: true, isNftEligible: true, sortOrder: 20 },
  { id: "skin_builder_legend", name: "Builder Legend", description: "Level 7 Builder", assetPath: "skins/skin_builder_legend.png", tier: "legendary", path: "builder", minLevel: 7, unlockCondition: "level:7+path:builder", isPremium: true, isNftEligible: true, sortOrder: 30 },
  { id: "skin_founder_1", name: "Founder I", description: "First pitch launched", assetPath: "skins/skin_founder_1.png", tier: "uncommon", path: "founder", minLevel: 2, unlockCondition: "pitches_launched:1", isPremium: false, isNftEligible: false, sortOrder: 11 },
  { id: "skin_founder_capsule", name: "Founder Storyteller", description: "10 project capsules posted", assetPath: "skins/skin_founder_capsule.png", tier: "rare", path: "founder", minLevel: 4, unlockCondition: "capsules_posted:10", isPremium: true, isNftEligible: true, sortOrder: 21 },
  { id: "skin_founder_legend", name: "Founder Legend", description: "Level 7 Founder", assetPath: "skins/skin_founder_legend.png", tier: "legendary", path: "founder", minLevel: 7, unlockCondition: "level:7+path:founder", isPremium: true, isNftEligible: true, sortOrder: 31 },
  { id: "skin_investor_gold", name: "Gold Backer", description: "1,000π invested in ecosystem", assetPath: "skins/skin_investor_gold.png", tier: "rare", path: "investor", minLevel: 3, unlockCondition: "total_pi_invested:1000", isPremium: true, isNftEligible: true, sortOrder: 22 },
  { id: "skin_investor_whale", name: "Whale", description: "10,000π invested in ecosystem", assetPath: "skins/skin_investor_whale.png", tier: "legendary", path: "investor", minLevel: 6, unlockCondition: "total_pi_invested:10000", isPremium: true, isNftEligible: true, sortOrder: 32 },
  { id: "skin_streak_30", name: "Iron Streak", description: "30-day consecutive login streak", assetPath: "skins/skin_streak_30.png", tier: "epic", path: "any", minLevel: 3, unlockCondition: "daily_streak:30", isPremium: true, isNftEligible: true, sortOrder: 40 },
  { id: "skin_diamond", name: "HumanVerse Diamond", description: "Reached Level 10 — the apex", assetPath: "skins/skin_diamond.png", tier: "legendary", path: "any", minLevel: 10, unlockCondition: "level:10", isPremium: true, isNftEligible: true, sortOrder: 99 },
];

export async function ensureAvatarExists(userId: string): Promise<typeof userAvatarsTable.$inferSelect> {
  const [existing] = await db.select().from(userAvatarsTable).where(eq(userAvatarsTable.userId, userId));
  if (existing) return existing;

  const id = uid("av");
  const [created] = await db.insert(userAvatarsTable)
    .values({ id, userId })
    .onConflictDoNothing({ target: userAvatarsTable.userId })
    .returning();
  if (created) {
    await db.insert(userUnlockedSkinsTable).values({ id: uid("usl"), userId, skinId: "skin_default", equipped: true });
    return created;
  }
  const [racedAvatar] = await db.select().from(userAvatarsTable).where(eq(userAvatarsTable.userId, userId));
  if (!racedAvatar) throw new Error("Could not initialize avatar");
  return racedAvatar;
}

export async function awardXp(
  userId: string,
  event: XpEventType,
  meta?: { piAmount?: number }
): Promise<{ newXp: number; newLevel: number; levelUp: boolean; newSkins: string[] }> {
  let xpDelta = XP_REWARDS[event] ?? 0;

  if (event === "pi_invested" && meta?.piAmount) {
    xpDelta = Math.floor(meta.piAmount / 10);
  }

  await ensureAvatarExists(userId);
  const result = await db.transaction(async (tx) => {
    const [avatar] = await tx.select().from(userAvatarsTable)
      .where(eq(userAvatarsTable.userId, userId))
      .for("update");
    if (!avatar) throw new Error("Avatar disappeared during reward update");

    const streakMultiplier = avatar.dailyStreak >= 30 ? 1.5 : avatar.dailyStreak >= 7 ? 1.2 : 1;
    const appliedXpDelta = event === "streak_bonus" ? Math.ceil(xpDelta * streakMultiplier) : xpDelta;
    const newXp = avatar.xp + appliedXpDelta;
    const oldLevel = avatar.level;
    const newLevel = computeLevel(newXp);

    const updates: Partial<typeof userAvatarsTable.$inferInsert> = {
      xp: newXp,
      level: newLevel,
      lastActivityAt: new Date(),
      decayActive: false,
      updatedAt: new Date(),
    };

    if (event === "escrow_completed") updates.escrowsCompleted = sql`${userAvatarsTable.escrowsCompleted} + 1` as unknown as number;
    if (event === "review_5_star" || event === "five_consecutive_reviews") updates.consecutiveFiveStarReviews = sql`${userAvatarsTable.consecutiveFiveStarReviews} + 1` as unknown as number;
    if (event === "pitch_launched") updates.pitchesLaunched = sql`${userAvatarsTable.pitchesLaunched} + 1` as unknown as number;
    if (event === "milestone_completed") updates.milestonesCompleted = sql`${userAvatarsTable.milestonesCompleted} + 1` as unknown as number;
    if (event === "capsule_posted") updates.capsulesPosted = sql`${userAvatarsTable.capsulesPosted} + 1` as unknown as number;
    if (event === "pi_invested" && meta?.piAmount) updates.totalPiInvested = sql`${userAvatarsTable.totalPiInvested} + ${meta.piAmount}` as unknown as number;

    await tx.update(userAvatarsTable).set(updates).where(eq(userAvatarsTable.userId, userId));
    return { newXp, newLevel, levelUp: newLevel > oldLevel };
  });

  const refreshed = await ensureAvatarExists(userId);
  const newSkins = await checkAndUnlockSkins(userId, refreshed);

  return { ...result, newSkins };
}

export async function checkAndUnlockSkins(userId: string, avatar: typeof userAvatarsTable.$inferSelect): Promise<string[]> {
  const alreadyUnlocked = await db.select({ skinId: userUnlockedSkinsTable.skinId })
    .from(userUnlockedSkinsTable).where(eq(userUnlockedSkinsTable.userId, userId));
  const unlockedSet = new Set(alreadyUnlocked.map((s) => s.skinId));

  const newlyUnlocked: string[] = [];

  for (const skin of SKIN_CATALOG) {
    if (unlockedSet.has(skin.id)) continue;
    if (skin.minLevel > avatar.level) continue;

    let unlocked = false;
    const cond = skin.unlockCondition;

    if (cond === "default") unlocked = true;
    else if (cond.startsWith("escrows_completed:")) { const n = parseInt(cond.split(":")[1]); unlocked = avatar.escrowsCompleted >= n; }
    else if (cond.startsWith("consecutive_five_star_reviews:")) { const n = parseInt(cond.split(":")[1]); unlocked = avatar.consecutiveFiveStarReviews >= n; }
    else if (cond.startsWith("pitches_launched:")) { const n = parseInt(cond.split(":")[1]); unlocked = avatar.pitchesLaunched >= n; }
    else if (cond.startsWith("capsules_posted:")) { const n = parseInt(cond.split(":")[1]); unlocked = avatar.capsulesPosted >= n; }
    else if (cond.startsWith("total_pi_invested:")) { const n = parseInt(cond.split(":")[1]); unlocked = avatar.totalPiInvested >= n; }
    else if (cond.startsWith("daily_streak:")) { const n = parseInt(cond.split(":")[1]); unlocked = avatar.dailyStreak >= n; }
    else if (cond.startsWith("level:")) {
      const [lvlPart, pathPart] = cond.split("+");
      const lvl = parseInt(lvlPart.split(":")[1]);
      if (pathPart) {
        const reqPath = pathPart.split(":")[1];
        unlocked = avatar.level >= lvl && avatar.path === reqPath;
      } else {
        unlocked = avatar.level >= lvl;
      }
    }

    if (unlocked) {
      await db.insert(userUnlockedSkinsTable).values({ id: uid("usl"), userId, skinId: skin.id, equipped: false });
      newlyUnlocked.push(skin.id);
    }
  }

  return newlyUnlocked;
}

export async function seedSkinCatalog(): Promise<void> {
  for (const skin of SKIN_CATALOG) {
    const [existing] = await db.select({ id: avatarSkinsTable.id }).from(avatarSkinsTable).where(eq(avatarSkinsTable.id, skin.id));
    if (!existing) {
      await db.insert(avatarSkinsTable).values(skin);
    }
  }
}
