import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  auditLogsTable,
  circleMembersTable,
  feeTransactionsTable,
  platformSettingsTable,
  smartAgreementsTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import { createNotification } from "../lib/notify";
import { currentUserId } from "../lib/currentUser";
import { auditLogValues } from "../lib/auditLog";
import { getPagination, validateBody, validateParams } from "../lib/requestSecurity";
import { requireAdmin } from "../middlewares/authMiddleware";

const router: IRouter = Router();
const adminRouter: IRouter = Router();

const settingsBody = z.object({
  escrowFeePercent: z.coerce.number().finite().min(0).max(100).optional(),
  withdrawalFlatFee: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  featuredPitchFee: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  kycVerificationFee: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  nftRoyaltyFeePercent: z.coerce.number().finite().min(0).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one setting is required");

const resolveBody = z.object({
  decision: z.enum(["release_founder", "refund_buyer"]),
}).strict();

const userStatusBody = z.object({
  role: z.enum(["user", "validator", "admin", "super_admin", "investor", "creator"]).optional(),
  accountStatus: z.enum(["active", "suspended", "banned"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "A role or accountStatus is required");

const idParams = z.object({ id: z.string().trim().min(1).max(160) }).strict();

function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function amount(centsValue: number): string {
  return (centsValue / 100).toFixed(2);
}

function serializeSettings(settings: typeof platformSettingsTable.$inferSelect) {
  return {
    ...settings,
    escrowFeePercent: Number(settings.escrowFeePercent),
    withdrawalFlatFee: Number(settings.withdrawalFlatFee),
    featuredPitchFee: Number(settings.featuredPitchFee),
    kycVerificationFee: Number(settings.kycVerificationFee),
    nftRoyaltyFeePercent: Number(settings.nftRoyaltyFeePercent),
  };
}

async function ensureSettings() {
  const [existing] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.id, "default")).limit(1);
  if (existing) return existing;
  await db.insert(platformSettingsTable).values({ id: "default" }).onConflictDoNothing();
  const [created] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.id, "default")).limit(1);
  if (!created) throw new Error("Platform settings could not be initialized");
  return created;
}

adminRouter.use(requireAdmin);

adminRouter.get("/analytics/revenue", async (_req, res): Promise<void> => {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [totals, monthly, pendingEscrow, subscriptions, breakdown, recentFees] = await Promise.all([
    db.select({
      totalRevenue: sql<string>`coalesce(sum(${feeTransactionsTable.feeAmount}), 0)`,
      grossVolume: sql<string>`coalesce(sum(${feeTransactionsTable.grossAmount}), 0)`,
      feeCount: count(),
    }).from(feeTransactionsTable),
    db.select({
      monthlyRevenue: sql<string>`coalesce(sum(${feeTransactionsTable.feeAmount}), 0)`,
    }).from(feeTransactionsTable).where(gte(feeTransactionsTable.createdAt, monthStart)),
    db.select({
      pending: sql<string>`coalesce(sum(${smartAgreementsTable.totalPiCommitted}), 0)`,
    }).from(smartAgreementsTable).where(inArray(smartAgreementsTable.status, ["LOCKED_IN_ESCROW", "ACTIVE"])),
    db.select({ active: count() }).from(circleMembersTable).where(eq(circleMembersTable.paid, true)),
    db.select({
      feeType: feeTransactionsTable.feeType,
      total: sql<string>`coalesce(sum(${feeTransactionsTable.feeAmount}), 0)`,
      count: count(),
    }).from(feeTransactionsTable).groupBy(feeTransactionsTable.feeType).orderBy(desc(sql`sum(${feeTransactionsTable.feeAmount})`)),
    db.select().from(feeTransactionsTable).orderBy(desc(feeTransactionsTable.createdAt)).limit(20),
  ]);

  res.json({
    totalPlatformRevenue: Number(totals[0]?.totalRevenue ?? 0),
    monthlyRevenue: Number(monthly[0]?.monthlyRevenue ?? 0),
    pendingEscrowFunds: Number(pendingEscrow[0]?.pending ?? 0),
    activeSubscriptions: subscriptions[0]?.active ?? 0,
    grossVolume: Number(totals[0]?.grossVolume ?? 0),
    feeTransactionCount: totals[0]?.feeCount ?? 0,
    breakdown: breakdown.map((row) => ({
      feeType: row.feeType,
      total: Number(row.total),
      count: row.count,
    })),
    recentFees: recentFees.map((row) => ({
      ...row,
      grossAmount: Number(row.grossAmount),
      feeAmount: Number(row.feeAmount),
      netAmount: Number(row.netAmount),
    })),
  });
});

adminRouter.get("/escrows", async (_req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const agreements = await db.select().from(smartAgreementsTable)
    .where(inArray(smartAgreementsTable.status, ["LOCKED_IN_ESCROW", "ACTIVE", "DISPUTED"]))
    .orderBy(desc(smartAgreementsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  const userIds = [...new Set(agreements.flatMap((agreement) => [agreement.senderId, agreement.receiverId]))];
  const users = userIds.length
    ? await db.select({
      id: usersTable.id,
      handle: usersTable.handle,
      name: usersTable.name,
      avatarKey: usersTable.avatarKey,
    }).from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  res.json(agreements.map((agreement) => ({
    ...agreement,
    totalPiCommitted: Number(agreement.totalPiCommitted),
    buyer: userById.get(agreement.senderId) ?? null,
    seller: userById.get(agreement.receiverId) ?? null,
    resolutionAvailable: agreement.status !== "COMPLETED" && agreement.status !== "REFUNDED",
  })));
});

adminRouter.post(
  "/escrows/:id/resolve",
  validateParams(idParams),
  validateBody(resolveBody),
  async (req, res): Promise<void> => {
    const adminId = currentUserId(req);
    const agreementId = queryString(req.params.id) ?? "";
    const { decision } = req.body as z.infer<typeof resolveBody>;
    const now = new Date();
    let result: {
      agreementId: string;
      decision: string;
      grossAmount: number;
      feeAmount: number;
      netAmount: number;
      currency: string;
    } | undefined;
    let notifyUserId: string | undefined;

    await db.transaction(async (tx) => {
      const [agreement] = await tx.select().from(smartAgreementsTable)
        .where(eq(smartAgreementsTable.id, agreementId))
        .for("update");
      if (!agreement) throw Object.assign(new Error("Escrow not found"), { status: 404 });
      if (agreement.status === "COMPLETED" || agreement.status === "REFUNDED") {
        throw Object.assign(new Error("Escrow has already been resolved"), { status: 409 });
      }

      const [settings] = await tx.select().from(platformSettingsTable)
        .where(eq(platformSettingsTable.id, "default"))
        .for("update");
      if (!settings) throw Object.assign(new Error("Platform settings are not initialized"), { status: 500 });

      const grossCents = cents(Number(agreement.totalPiCommitted));
      const feeCents = decision === "release_founder"
        ? Math.round(grossCents * Number(settings.escrowFeePercent) / 100)
        : 0;
      const netCents = grossCents - feeCents;
      const feeId = id("fee");

      await tx.update(smartAgreementsTable).set({
        status: decision === "release_founder" ? "COMPLETED" : "REFUNDED",
        disputeStatus: "resolved",
        completedAt: now,
        updatedAt: now,
      }).where(eq(smartAgreementsTable.id, agreementId));

      if (feeCents > 0) {
        await tx.insert(feeTransactionsTable).values({
          id: feeId,
          sourceTransactionId: agreementId,
          feeType: "escrow_cut",
          grossAmount: amount(grossCents),
          feeAmount: amount(feeCents),
          netAmount: amount(netCents),
          currency: "PI",
          status: "recorded",
        });
      }

      await tx.insert(transactionsTable).values({
        id: id("tx"),
        userId: decision === "release_founder" ? agreement.receiverId : agreement.senderId,
        pitchId: agreement.projectId,
        amount: Math.floor(netCents / 100),
        type: decision === "release_founder" ? "escrow_release" : "escrow_refund",
        fromUserId: agreement.senderId,
        toUserId: decision === "release_founder" ? agreement.receiverId : agreement.senderId,
        status: "completed",
        note: decision === "release_founder"
          ? `Admin settlement; ${Number(settings.escrowFeePercent).toFixed(2)}% platform fee recorded`
          : "Admin settlement; buyer refund recorded",
        agreementId,
      });

      await tx.insert(auditLogsTable).values(auditLogValues({
        entityType: "escrow",
        entityId: agreementId,
        actorId: adminId,
        action: decision === "release_founder" ? "ESCROW_RELEASED_TO_FOUNDER" : "ESCROW_REFUNDED_TO_BUYER",
        metadata: {
          grossAmount: Number(agreement.totalPiCommitted),
          feeAmount: feeCents / 100,
          netAmount: netCents / 100,
          currency: "PI",
          feeTransactionId: feeCents > 0 ? feeId : null,
        },
        req,
      }));

      notifyUserId = decision === "release_founder" ? agreement.receiverId : agreement.senderId;
      result = {
        agreementId,
        decision,
        grossAmount: grossCents / 100,
        feeAmount: feeCents / 100,
        netAmount: netCents / 100,
        currency: "PI",
      };
    });

    if (notifyUserId && result) {
      await createNotification({
        userId: notifyUserId,
        type: "escrow_resolved",
        actorId: adminId,
        amount: result.netAmount,
        message: result.decision === "release_founder"
          ? `released ${result.netAmount.toLocaleString()} π from escrow after the platform fee`
          : `refunded ${result.netAmount.toLocaleString()} π from escrow`,
      });
    }

    res.json(result);
  },
);

adminRouter.get("/users", async (req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const search = queryString(req.query.search);
  const role = queryString(req.query.role);
  const accountStatus = queryString(req.query.accountStatus);
  const filters = [];

  if (search) {
    const pattern = `%${search.slice(0, 80)}%`;
    filters.push(or(
      ilike(usersTable.name, pattern),
      ilike(usersTable.handle, pattern),
      ilike(usersTable.email, pattern),
    ));
  }
  if (role) filters.push(eq(usersTable.role, role));
  if (accountStatus) filters.push(eq(usersTable.accountStatus, accountStatus));

  const users = await db.select({
    id: usersTable.id,
    handle: usersTable.handle,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    accountStatus: usersTable.accountStatus,
    kycStatus: usersTable.kycStatus,
    reputationScore: usersTable.reputationScore,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(usersTable.name))
    .limit(limit)
    .offset(offset);

  res.json(users);
});

adminRouter.patch(
  "/users/:id/status",
  validateParams(idParams),
  validateBody(userStatusBody),
  async (req, res): Promise<void> => {
    const adminId = currentUserId(req);
    const targetId = queryString(req.params.id) ?? "";
    const updates = req.body as z.infer<typeof userStatusBody>;
    if (targetId === adminId && (updates.role === "user" || updates.role === "validator" || updates.accountStatus !== "active")) {
      res.status(400).json({ error: "You cannot remove your own admin access or suspend your own account" });
      return;
    }

    let updatedUser: typeof usersTable.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(usersTable).where(eq(usersTable.id, targetId)).for("update");
      if (!target) throw Object.assign(new Error("User not found"), { status: 404 });
      const [updated] = await tx.update(usersTable).set({
        ...(updates.role ? { role: updates.role } : {}),
        ...(updates.accountStatus ? { accountStatus: updates.accountStatus } : {}),
      }).where(eq(usersTable.id, targetId)).returning();
      updatedUser = updated;
      await tx.insert(auditLogsTable).values(auditLogValues({
        entityType: "user",
        entityId: targetId,
        actorId: adminId,
        action: "ADMIN_USER_STATUS_UPDATED",
        metadata: { role: updates.role, accountStatus: updates.accountStatus },
        req,
      }));
    });

    res.json({
      id: updatedUser?.id,
      handle: updatedUser?.handle,
      email: updatedUser?.email,
      role: updatedUser?.role,
      accountStatus: updatedUser?.accountStatus,
    });
  },
);

adminRouter.get("/audit-logs", async (req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const action = queryString(req.query.action);
  const userId = queryString(req.query.userId);
  const filters = [];
  if (action) filters.push(ilike(auditLogsTable.action, `%${action.slice(0, 80)}%`));
  if (userId) filters.push(eq(auditLogsTable.userId, userId));

  const logs = await db.select().from(auditLogsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(logs.map((log) => ({
    ...log,
    details: log.details ?? (() => {
      try {
        return log.metadata ? JSON.parse(log.metadata) : {};
      } catch {
        return {};
      }
    })(),
  })));
});

adminRouter.get("/settings", async (_req, res): Promise<void> => {
  res.json(serializeSettings(await ensureSettings()));
});

adminRouter.patch(
  "/settings",
  validateBody(settingsBody),
  async (req, res): Promise<void> => {
    const adminId = currentUserId(req);
    const input = req.body as z.infer<typeof settingsBody>;
    let settings: typeof platformSettingsTable.$inferSelect | undefined;

    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(platformSettingsTable)
        .where(eq(platformSettingsTable.id, "default"))
        .for("update");
      if (!current) throw Object.assign(new Error("Platform settings are not initialized"), { status: 500 });
      const [updated] = await tx.update(platformSettingsTable).set({
        ...(input.escrowFeePercent !== undefined ? { escrowFeePercent: input.escrowFeePercent.toFixed(2) } : {}),
        ...(input.withdrawalFlatFee !== undefined ? { withdrawalFlatFee: input.withdrawalFlatFee.toFixed(2) } : {}),
        ...(input.featuredPitchFee !== undefined ? { featuredPitchFee: input.featuredPitchFee.toFixed(2) } : {}),
        ...(input.kycVerificationFee !== undefined ? { kycVerificationFee: input.kycVerificationFee.toFixed(2) } : {}),
        ...(input.nftRoyaltyFeePercent !== undefined ? { nftRoyaltyFeePercent: input.nftRoyaltyFeePercent.toFixed(2) } : {}),
        updatedAt: new Date(),
      }).where(eq(platformSettingsTable.id, "default")).returning();
      settings = updated;
      await tx.insert(auditLogsTable).values(auditLogValues({
        entityType: "platform_settings",
        entityId: "default",
        actorId: adminId,
        action: "ADMIN_FEE_UPDATE",
        metadata: { changedKeys: Object.keys(input) },
        req,
      }));
    });

    res.json(settings ? serializeSettings(settings) : null);
  },
);

router.use("/admin", adminRouter);

export default router;