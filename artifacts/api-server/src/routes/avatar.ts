import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, userAvatarsTable, avatarSkinsTable, userUnlockedSkinsTable,
  nftListingsTable, nftTransactionsTable, usersTable, auditLogsTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { ensureAvatarExists, awardXp, checkAndUnlockSkins, computeLevel } from "../lib/xpEngine";
import { getPagination } from "../lib/requestSecurity";
import { auditLogValues } from "../lib/auditLog";
import { AppError } from "../lib/errors";

const router: IRouter = Router();
const NFT_MIN_LEVEL = 5;
const ROYALTY_PCT = 25;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.get("/users/:id/avatar", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const canViewProgress = id === meId || req.user?.role === "admin";
  const avatar = await ensureAvatarExists(id);

  const unlockedRows = canViewProgress
    ? await db.select({ skinId: userUnlockedSkinsTable.skinId })
        .from(userUnlockedSkinsTable).where(eq(userUnlockedSkinsTable.userId, id))
    : [];
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
    unlockedSkins: canViewProgress ? unlockedIds : [],
    nextLevelXp: canViewProgress ? nextLevelXp : null,
    xpToNextLevel: canViewProgress && nextLevelXp !== null ? Math.max(0, nextLevelXp - currentXpInLevel) : 0,
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
  await db.transaction(async (tx) => {
    const [lockedAvatar] = await tx.select().from(userAvatarsTable)
      .where(eq(userAvatarsTable.userId, meId))
      .for("update");
    if (!lockedAvatar || lockedAvatar.level < NFT_MIN_LEVEL) {
      throw new AppError(403, "NFT_LEVEL_REQUIRED", `Avatar must be Level ${NFT_MIN_LEVEL}+ to mint as an NFT`);
    }
    if (lockedAvatar.mintStatus === "minted") {
      throw new AppError(409, "NFT_ALREADY_MINTED", "Avatar is already minted as an NFT");
    }
    await tx.update(userAvatarsTable).set({
      mintStatus: "minted",
      mintedAt: new Date(),
      nftTokenId,
      updatedAt: new Date(),
    }).where(eq(userAvatarsTable.userId, meId));
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "financial",
      entityId: lockedAvatar.id,
      actorId: meId,
      action: "NFT_MINTED",
      metadata: { avatarId: lockedAvatar.id, level: lockedAvatar.level },
      req,
    }));
  });

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

  const id = uid("lst");
  await db.transaction(async (tx) => {
    await tx.select().from(userAvatarsTable).where(eq(userAvatarsTable.id, avatar.id)).for("update");
    const existingActive = await tx.select().from(nftListingsTable)
      .where(and(eq(nftListingsTable.sellerId, meId), eq(nftListingsTable.status, "active")));
    if (existingActive.length > 0) {
      throw new AppError(409, "ACTIVE_LISTING_EXISTS", "You already have an active listing. Remove it before creating a new one.");
    }
    await tx.insert(nftListingsTable).values({ id, sellerId: meId, avatarId: avatar.id, pricePi });
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "financial",
      entityId: id,
      actorId: meId,
      action: "NFT_LISTED",
      metadata: { listingId: id, pricePi },
      req,
    }));
  });
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

  const now = new Date();

  const txId = uid("nfttx");
  let sellerReceives = 0;
  let royaltyPi = 0;
  await db.transaction(async (tx) => {
    const [lockedListing] = await tx.select().from(nftListingsTable)
      .where(eq(nftListingsTable.id, listingId))
      .for("update");
    if (!lockedListing || lockedListing.status !== "active") {
      throw new AppError(409, "LISTING_NOT_ACTIVE", "This listing is no longer active");
    }
    if (lockedListing.sellerId === meId) {
      throw new AppError(400, "INVALID_PURCHASE", "Cannot buy your own listing");
    }
    const [lockedAvatar] = await tx.select().from(userAvatarsTable)
      .where(eq(userAvatarsTable.id, lockedListing.avatarId))
      .for("update");
    if (!lockedAvatar || lockedAvatar.userId !== lockedListing.sellerId) {
      throw new AppError(409, "NFT_STATE_INVALID", "The NFT is not available for transfer");
    }
    royaltyPi = Math.ceil(lockedListing.pricePi * ROYALTY_PCT / 1000);
    sellerReceives = lockedListing.pricePi - royaltyPi;
    await tx.update(nftListingsTable).set({ status: "sold", soldAt: now, buyerId: meId }).where(eq(nftListingsTable.id, listingId));
    await tx.update(userAvatarsTable).set({ userId: meId, updatedAt: now }).where(eq(userAvatarsTable.id, lockedListing.avatarId));
    await tx.insert(nftTransactionsTable).values({
      id: txId,
      listingId,
      sellerId: lockedListing.sellerId,
      buyerId: meId,
      avatarId: lockedListing.avatarId,
      pricePi: lockedListing.pricePi,
      royaltyPi,
      royaltyPct: ROYALTY_PCT,
    });
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "financial",
      entityId: txId,
      actorId: meId,
      action: "NFT_PURCHASED",
      metadata: { listingId, transactionId: txId, pricePi: lockedListing.pricePi, royaltyPi },
      req,
    }));
  });

  res.json({ purchased: true, sellerReceives, royaltyPi, platform: "HumanVerse", txId });
});

router.delete("/avatar/nft/list/:listingId", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const listingId = Array.isArray(req.params.listingId) ? req.params.listingId[0] : req.params.listingId;

  await db.transaction(async (tx) => {
    const [listing] = await tx.select().from(nftListingsTable)
      .where(eq(nftListingsTable.id, listingId))
      .for("update");
    if (!listing) throw new AppError(404, "LISTING_NOT_FOUND", "Not found");
    if (listing.sellerId !== meId) throw new AppError(403, "FORBIDDEN", "Forbidden");
    if (listing.status !== "active") throw new AppError(409, "LISTING_NOT_ACTIVE", "Listing is not active");
    await tx.update(nftListingsTable)
      .set({ status: "cancelled" })
      .where(and(eq(nftListingsTable.id, listingId), eq(nftListingsTable.status, "active")));
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "financial",
      entityId: listingId,
      actorId: meId,
      action: "NFT_LISTING_CANCELLED",
      metadata: { listingId },
      req,
    }));
  });
  res.json({ cancelled: true });
});

export default router;
