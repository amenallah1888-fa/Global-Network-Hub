import { Router, type IRouter } from "express";
import { and, avg, count, desc, eq } from "drizzle-orm";
import { db, reviewsTable, transactionsTable, serviceAppsTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { addReputationEvent } from "../lib/reputation";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.post("/reviews", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};
  const transactionId = String(body.transactionId ?? "").trim();
  const rating = Math.min(5, Math.max(1, parseInt(String(body.rating ?? "0"), 10)));
  const reviewBody = String(body.body ?? "").trim().slice(0, 1000);

  if (!transactionId || !rating) {
    res.status(400).json({ error: "transactionId and rating (1–5) required" }); return;
  }

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, transactionId));
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

  const isParty = tx.fromUserId === meId || tx.userId === meId;
  if (!isParty) { res.status(403).json({ error: "You were not a party to this transaction" }); return; }

  if (tx.status !== "completed") {
    res.status(403).json({ error: "Reviews can only be submitted for completed transactions" }); return;
  }

  const existing = await db.select().from(reviewsTable).where(
    and(eq(reviewsTable.transactionId, transactionId), eq(reviewsTable.authorId, meId))
  );
  if (existing.length > 0) { res.status(409).json({ error: "You already reviewed this transaction" }); return; }

  const targetId = tx.serviceId ?? tx.pitchId;
  const targetType = tx.serviceId ? "service" : "pitch";
  const targetUserId = tx.toUserId ?? (tx.fromUserId === meId ? undefined : tx.fromUserId);

  const id = uid("rev");
  await db.insert(reviewsTable).values({ id, authorId: meId, targetId, targetType, transactionId, rating, body: reviewBody, onChain: true });

  if (targetUserId) {
    await addReputationEvent(targetUserId, "review_received", `Received a ${rating}-star review`, id);
  }

  if (tx.serviceId) {
    const [agg] = await db.select({ avg: avg(reviewsTable.rating) }).from(reviewsTable).where(eq(reviewsTable.targetId, tx.serviceId));
    const newRating = Math.round(Number(agg?.avg ?? rating));
    await db.update(serviceAppsTable).set({ rating: newRating }).where(eq(serviceAppsTable.id, tx.serviceId));
  }

  const [created] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
});

router.get("/reviews/:targetType/:targetId", async (req, res): Promise<void> => {
  const targetId = Array.isArray(req.params.targetId) ? req.params.targetId[0] : req.params.targetId;
  const targetType = Array.isArray(req.params.targetType) ? req.params.targetType[0] : req.params.targetType;

  const reviews = await db.select().from(reviewsTable)
    .where(and(eq(reviewsTable.targetId, targetId), eq(reviewsTable.targetType, targetType)))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(50);

  const authorIds = [...new Set(reviews.map((r) => r.authorId))];
  const authors = authorIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey })
        .from(usersTable).where(eq(usersTable.id, authorIds[0]))
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const [agg] = await db.select({
    total: count(),
    avgRating: avg(reviewsTable.rating),
  }).from(reviewsTable).where(and(eq(reviewsTable.targetId, targetId), eq(reviewsTable.targetType, targetType)));

  res.json({
    reviews: reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), author: authorMap.get(r.authorId) ?? null })),
    summary: { total: agg?.total ?? 0, avgRating: Number(agg?.avgRating ?? 0).toFixed(1) },
  });
});

export default router;
