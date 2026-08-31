import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, userAvatarsTable, avatarSkinsTable, userUnlockedSkinsTable,
  nftListingsTable, nftTransactionsTable, usersTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { ensureAvatarExists, awardXp, checkAndUnlockSkins, computeLevel } from "../lib/xpEngine";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();
const NFT_MIN_LEVEL = 5;
const ROYALTY_PCT = 25;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.get("/users/:id/avatar", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const avatar = await ensureAvatarExists(id);

  const unlockedRows = await db.select({ skinId: userUnlockedSkinsTable.skinId })
    .from(userUnlockedSkinsTable).where(eq(userUnlockedSkinsTable.userId, id));
  const unlockedIds = unlockedRows.map((r) => r.skinId);

  const [skin] = await db.select().from(avatarSkinsTable).where(eq(avatarSkinsTable.id, avatar.currentSkinId));
  const currentXpInLevel = avatar.xp;
  const nextLevelXp = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000][avatar.level] ?? null;

  res.json({
    ...avatar,
    lastActivityAt: avatar.lastActivityAt.toISOString(),
    createdAt: avatar.createdAt.toISOString(),
    updatedAt: avatar.updatedAt.toISOString(),
    activeSkin: skin ?? null,
    activeSkinUrl: skin?.assetPath ?? "skins/skin_default.png",
    unlockedSkins: unlockedIds,
    nextLevelXp,
    xpToNextLevel: nextLevelXp !== null ? Math.max(0, nextLevelXp - currentXpInLevel) : 0,
  });
});

router.post("/avatar/checkin", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const avatar = await ensureAvatarExists(meId);

  const today = new Date().toISOString().split("T")[0];
  if (avatar.lastLoginDate === today) {
    res.json({ alreadyCheckedIn: true, streak: avatar.dailyStreak, xp: avatar.xp }); return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const newStreak = avatar.lastLoginDate === yesterday ? avatar.dailyStreak + 1 : 1;
  const is30Day = newStreak === 30;

  await db.update(userAvatarsTable).set({
    dailyStreak: newStreak,
    lastLoginDate: today,
    lastActivityAt: new Date(),
    decayActive: false,
    updatedAt: new Date(),
  }).where(eq(userAvatarsTable.userId, meId));

  const result = await awardXp(meId, "daily_checkin");
  if (is30Day) {
    const bonus = await awardXp(meId, "streak_30_day");
    res.json({ ...result, streakBonus: true, streak: newStreak, bonusXp: 200, ...bonus }); return;
  }

  const newSkins = await checkAndUnlockSkins(meId, { ...avatar, dailyStreak: newStreak });
  res.json({ ...result, streak: newStreak, newSkins });
});

router.post("/avatar/equip", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const skinId = String(req.body?.skinId ?? "").trim();
  if (!skinId) { res.status(400).json({ error: "skinId required" }); return; }

  const [unlocked] = await db.select().from(userUnlockedSkinsTable)
    .where(and(eq(userUnlockedSkinsTable.userId, meId), eq(userUnlockedSkinsTable.skinId, skinId)));
  if (!unlocked) { res.status(403).json({ error: "You have not unlocked this skin" }); return; }

  const [skin] = await db.select().from(avatarSkinsTable).where(eq(avatarSkinsTable.id, skinId));
  if (!skin) { res.status(404).json({ error: "Skin not found" }); return; }

  const avatar = await ensureAvatarExists(meId);
  if (skin.isPremium && avatar.decayActive) {
    res.status(403).json({ error: "Premium skins are locked during inactivity decay. Log back in for 1 day to reactivate." }); return;
  }

  await db.update(userAvatarsTable).set({ currentSkinId: skinId, updatedAt: new Date() }).where(eq(userAvatarsTable.userId, meId));
  res.json({ equipped: skinId, assetPath: skin.assetPath });
});

router.get("/avatar/skins", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const { limit, offset } = getPagination(res);
  const all = await db.select().from(avatarSkinsTable).orderBy(avatarSkinsTable.sortOrder).limit(limit).offset(offset);

  const unlocked = await db.select({ skinId: userUnlockedSkinsTable.skinId })
    .from(userUnlockedSkinsTable).where(eq(userUnlockedSkinsTable.userId, meId));
  const unlockedSet = new Set(unlocked.map((u) => u.skinId));

  res.json(all.map((s) => ({ ...s, unlocked: unlockedSet.has(s.id) })));
});

router.post("/avatar/set-path", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const path = req.body?.path as string;
  if (!["builder", "founder", "investor", "none"].includes(path)) {
    res.status(400).json({ error: "path must be builder | founder | investor | none" }); return;
  }

  await db.update(userAvatarsTable).set({ path, updatedAt: new Date() }).where(eq(userAvatarsTable.userId, meId));
  const avatar = await ensureAvatarExists(meId);
  const newSkins = await checkAndUnlockSkins(meId, avatar);
  res.json({ path, newSkins });
});

router.post("/avatar/nft/mint", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const avatar = await ensureAvatarExists(meId);

  if (avatar.level < NFT_MIN_LEVEL) {
    res.status(403).json({ error: `Avatar must be Level ${NFT_MIN_LEVEL}+ to mint as an NFT. Current level: ${avatar.level}` }); return;
  }
  if (avatar.mintStatus === "minted") {
    res.status(409).json({ error: "Avatar is already minted as an NFT" }); return;
  }

  const nftTokenId = `hvnft_${meId}_${Date.now().toString(36)}`;
  await db.update(userAvatarsTable).set({
    mintStatus: "minted",
    mintedAt: new Date(),
    nftTokenId,
    updatedAt: new Date(),
  }).where(eq(userAvatarsTable.userId, meId));

  res.json({ minted: true, nftTokenId, level: avatar.level, currentSkinId: avatar.currentSkinId });
});

router.post("/avatar/nft/list", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const pricePi = parseInt(String(req.body?.pricePi ?? "0"), 10);
  if (pricePi < 1) { res.status(400).json({ error: "pricePi must be at least 1" }); return; }

  const avatar = await ensureAvatarExists(meId);
  if (avatar.mintStatus !== "minted") {
    res.status(403).json({ error: "Avatar must be minted before listing on the marketplace" }); return;
  }

  const existingActive = await db.select().from(nftListingsTable)
    .where(and(eq(nftListingsTable.sellerId, meId), eq(nftListingsTable.status, "active")));
  if (existingActive.length > 0) {
    res.status(409).json({ error: "You already have an active listing. Remove it before creating a new one." }); return;
  }

  const id = uid("lst");
  await db.insert(nftListingsTable).values({ id, sellerId: meId, avatarId: avatar.id, pricePi });
  res.status(201).json({ listingId: id, pricePi, status: "active" });
});

router.get("/avatar/nft/marketplace", async (_req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const listings = await db.select().from(nftListingsTable)
    .where(eq(nftListingsTable.status, "active"))
    .orderBy(desc(nftListingsTable.createdAt))
    .limit(limit).offset(offset);

  const sellerIds = [...new Set(listings.map((l) => l.sellerId))];
  const sellers = sellerIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey })
        .from(usersTable).where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(sellerIds.map((id) => sql`${id}`), sql`, `)}])`)
    : [];
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));

  const avatarIds = listings.map((l) => l.avatarId);
  const avatars = avatarIds.length > 0
    ? await db.select().from(userAvatarsTable)
        .where(sql`${userAvatarsTable.id} = ANY(ARRAY[${sql.join(avatarIds.map((id) => sql`${id}`), sql`, `)}])`)
    : [];
  const avatarMap = new Map(avatars.map((a) => [a.id, a]));

  res.json(listings.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    seller: sellerMap.get(l.sellerId) ?? null,
    avatar: avatarMap.get(l.avatarId) ?? null,
    royaltyOnSale: Math.ceil(l.pricePi * ROYALTY_PCT / 1000),
  })));
});

router.post("/avatar/nft/buy/:listingId", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const listingId = Array.isArray(req.params.listingId) ? req.params.listingId[0] : req.params.listingId;

  const [listing] = await db.select().from(nftListingsTable).where(eq(nftListingsTable.id, listingId));
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.status !== "active") { res.status(400).json({ error: "This listing is no longer active" }); return; }
  if (listing.sellerId === meId) { res.status(400).json({ error: "Cannot buy your own listing" }); return; }

  const royaltyPi = Math.ceil(listing.pricePi * ROYALTY_PCT / 1000);
  const sellerReceives = listing.pricePi - royaltyPi;
  const now = new Date();

  const txId = uid("nfttx");
  await db.transaction(async (tx) => {
    const [lockedListing] = await tx.select().from(nftListingsTable).where(eq(nftListingsTable.id, listingId));
    if (!lockedListing || lockedListing.status !== "active") {
      throw new Error("Listing is no longer active");
    }
    await tx.update(nftListingsTable).set({ status: "sold", soldAt: now, buyerId: meId }).where(eq(nftListingsTable.id, listingId));
    await tx.update(userAvatarsTable).set({ userId: meId, updatedAt: now }).where(eq(userAvatarsTable.id, listing.avatarId));
    await tx.insert(nftTransactionsTable).values({
      id: txId,
      listingId,
      sellerId: listing.sellerId,
      buyerId: meId,
      avatarId: listing.avatarId,
      pricePi: listing.pricePi,
      royaltyPi,
      royaltyPct: ROYALTY_PCT,
    });
  });

  res.json({ purchased: true, sellerReceives, royaltyPi, platform: "HumanVerse", txId });
});

router.delete("/avatar/nft/list/:listingId", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const listingId = Array.isArray(req.params.listingId) ? req.params.listingId[0] : req.params.listingId;

  const [listing] = await db.select().from(nftListingsTable).where(eq(nftListingsTable.id, listingId));
  if (!listing) { res.status(404).json({ error: "Not found" }); return; }
  if (listing.sellerId !== meId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (listing.status !== "active") { res.status(400).json({ error: "Listing is not active" }); return; }

  await db.update(nftListingsTable).set({ status: "cancelled" }).where(eq(nftListingsTable.id, listingId));
  res.json({ cancelled: true });
});

export default router;
