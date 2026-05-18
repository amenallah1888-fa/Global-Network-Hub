import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, transactionsTable, amlFlagsTable } from "@workspace/db";

const VELOCITY_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRANSACTIONS_PER_WINDOW = 5;
const MAX_AMOUNT_PER_WINDOW = 50_000;

function uid() {
  return `aml_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function runAmlCheck(userId: string, amount: number, pitchId: string): Promise<{ blocked: boolean; reason?: string }> {
  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MS);

  const recent = await db.select().from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        gte(transactionsTable.createdAt, windowStart),
      )
    )
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  const recentCount = recent.length;
  const recentTotal = recent.reduce((s, t) => s + t.amount, 0);

  if (recentCount >= MAX_TRANSACTIONS_PER_WINDOW) {
    await db.insert(amlFlagsTable).values({
      id: uid(),
      userId,
      pitchId,
      totalAmount: recentTotal + amount,
      transactionCount: recentCount + 1,
      flagReason: `VELOCITY_LIMIT: ${recentCount + 1} transactions in 15 min`,
      status: "ACTIVE",
      frozen: true,
    });
    return { blocked: true, reason: "Transaction velocity limit exceeded. Your account has been flagged for review." };
  }

  if (recentTotal + amount > MAX_AMOUNT_PER_WINDOW) {
    await db.insert(amlFlagsTable).values({
      id: uid(),
      userId,
      pitchId,
      totalAmount: recentTotal + amount,
      transactionCount: recentCount + 1,
      flagReason: `AMOUNT_LIMIT: ${recentTotal + amount} π in 15 min`,
      status: "ACTIVE",
      frozen: true,
    });
    return { blocked: true, reason: "Transaction amount limit exceeded. This activity has been flagged for security review." };
  }

  const recipientTxns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.pitchId, pitchId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(100);

  const uniqueSenders = new Set(recipientTxns.map((t) => t.userId));
  const rapidInflow = recipientTxns.filter((t) => t.createdAt >= windowStart).length;

  if (rapidInflow >= 20 && uniqueSenders.size < 3) {
    await db.insert(amlFlagsTable).values({
      id: uid(),
      userId,
      pitchId,
      totalAmount: amount,
      transactionCount: 1,
      flagReason: `SUSPICIOUS_ACTIVITY: ${rapidInflow} rapid inflows from ${uniqueSenders.size} unique wallets`,
      status: "ACTIVE",
      frozen: true,
    });
    return { blocked: true, reason: "Suspicious transaction pattern detected on this project. The project has been flagged for review." };
  }

  return { blocked: false };
}
