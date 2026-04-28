import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  likesTable,
  retweetsTable,
  followsTable,
  tipsTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

async function decoratePosts(meId: string, posts: (typeof postsTable.$inferSelect)[]) {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const [likes, rts] = await Promise.all([
    db
      .select()
      .from(likesTable)
      .where(and(eq(likesTable.userId, meId), inArray(likesTable.postId, ids))),
    db
      .select()
      .from(retweetsTable)
      .where(
        and(eq(retweetsTable.userId, meId), inArray(retweetsTable.postId, ids)),
      ),
  ]);
  const likeSet = new Set(likes.map((l) => l.postId));
  const rtSet = new Set(rts.map((r) => r.postId));
  return posts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    liked: likeSet.has(p.id),
    retweeted: rtSet.has(p.id),
  }));
}

router.get("/posts", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const feed = (req.query.feed as string | undefined) ?? "foryou";

  let rows = await db
    .select()
    .from(postsTable)
    .orderBy(desc(postsTable.createdAt));

  if (feed === "following") {
    const follows = await db
      .select()
      .from(followsTable)
      .where(eq(followsTable.followerId, meId));
    const allowed = new Set([meId, ...follows.map((f) => f.followingId)]);
    rows = rows.filter((p) => allowed.has(p.authorId));
  } else if (feed === "investors") {
    rows = rows.filter((p) =>
      /invest|series|fund|venture|capital|backed|raise|raising/i.test(p.text),
    );
  } else if (feed === "hiring") {
    rows = rows.filter((p) =>
      /hir|recruit|join|role|engineer|PM|design/i.test(p.text),
    );
  }

  res.json(await decoratePosts(meId, rows));
});

router.post("/posts", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const imageKey =
    typeof req.body?.imageKey === "string" ? req.body.imageKey : null;
  if (!text) {
    res.status(400).json({ error: "text required" });
    return;
  }
  const id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const [post] = await db
    .insert(postsTable)
    .values({ id, authorId: meId, text, imageKey, category: "general" })
    .returning();
  const [decorated] = await decoratePosts(meId, [post]);
  res.status(201).json(decorated);
});

router.post("/posts/:id/like", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }

  const existing = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.postId, id), eq(likesTable.userId, meId)));

  if (existing.length > 0) {
    await db
      .delete(likesTable)
      .where(and(eq(likesTable.postId, id), eq(likesTable.userId, meId)));
    await db
      .update(postsTable)
      .set({ likesCount: sql`GREATEST(${postsTable.likesCount} - 1, 0)` })
      .where(eq(postsTable.id, id));
  } else {
    await db.insert(likesTable).values({ postId: id, userId: meId });
    await db
      .update(postsTable)
      .set({ likesCount: sql`${postsTable.likesCount} + 1` })
      .where(eq(postsTable.id, id));
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
    if (post) {
      await createNotification({
        userId: post.authorId,
        type: "like",
        actorId: meId,
        postId: id,
        message: "liked your post",
      });
    }
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [decorated] = await decoratePosts(meId, [post]);
  res.json(decorated);
});

router.post("/posts/:id/retweet", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }

  const existing = await db
    .select()
    .from(retweetsTable)
    .where(and(eq(retweetsTable.postId, id), eq(retweetsTable.userId, meId)));

  if (existing.length > 0) {
    await db
      .delete(retweetsTable)
      .where(and(eq(retweetsTable.postId, id), eq(retweetsTable.userId, meId)));
    await db
      .update(postsTable)
      .set({ retweetsCount: sql`GREATEST(${postsTable.retweetsCount} - 1, 0)` })
      .where(eq(postsTable.id, id));
  } else {
    await db.insert(retweetsTable).values({ postId: id, userId: meId });
    await db
      .update(postsTable)
      .set({ retweetsCount: sql`${postsTable.retweetsCount} + 1` })
      .where(eq(postsTable.id, id));
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
    if (post) {
      await createNotification({
        userId: post.authorId,
        type: "retweet",
        actorId: meId,
        postId: id,
        message: "reposted your post",
      });
    }
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [decorated] = await decoratePosts(meId, [post]);
  res.json(decorated);
});

router.post("/posts/:id/tip", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const amount = parseInt(String(req.body?.amount ?? ""), 10);
  if (!id || !Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    res.status(400).json({ error: "invalid id or amount" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.insert(tipsTable).values({
    postId: id,
    fromUserId: meId,
    toUserId: post.authorId,
    amount,
  });
  await db
    .update(postsTable)
    .set({ tipsTotal: sql`${postsTable.tipsTotal} + ${amount}` })
    .where(eq(postsTable.id, id));

  await createNotification({
    userId: post.authorId,
    type: "tip",
    actorId: meId,
    postId: id,
    amount,
    message: `tipped you $${amount}`,
  });

  const [updated] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id));
  const [decorated] = await decoratePosts(meId, [updated]);
  res.json(decorated);
});

export default router;
