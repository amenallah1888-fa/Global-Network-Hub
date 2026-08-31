import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  likesTable,
  retweetsTable,
  followsTable,
  tipsTable,
  commentsTable,
  usersTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";
import { getPagination, validateBody, validateParams } from "../lib/requestSecurity";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
const idParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/) });
const textBody = z.object({ text: z.string().trim().min(1).max(5000) }).strict();
const amountBody = z.object({ amount: z.coerce.number().int().positive().max(10000) }).strict();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function decoratePosts(meId: string, posts: (typeof postsTable.$inferSelect)[]) {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const [likes, rts] = await Promise.all([
    db.select().from(likesTable).where(and(eq(likesTable.userId, meId), inArray(likesTable.postId, ids))),
    db.select().from(retweetsTable).where(and(eq(retweetsTable.userId, meId), inArray(retweetsTable.postId, ids))),
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
  const { limit, offset } = getPagination(res);

  let rows = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).limit(limit).offset(offset);

  if (feed === "following") {
    const follows = await db.select().from(followsTable).where(eq(followsTable.followerId, meId));
    const allowed = new Set([meId, ...follows.map((f) => f.followingId)]);
    rows = rows.filter((p) => allowed.has(p.authorId));
  } else if (feed === "investors") {
    rows = rows.filter((p) => /invest|series|fund|venture|capital|backed|raise|raising/i.test(p.text));
  } else if (feed === "hiring") {
    rows = rows.filter((p) => /hir|recruit|join|role|engineer|PM|design/i.test(p.text));
  }

  res.json(await decoratePosts(meId, rows));
});

router.post("/posts", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const parsed = z.object({
    text: z.string().trim().min(1).max(5000),
    imageKey: z.string().max(500).nullable().optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request payload", code: "INVALID_REQUEST" }); return; }
  const text = parsed.data.text;
  const imageKey = parsed.data.imageKey ?? null;
  if (!text) { res.status(400).json({ error: "text required" }); return; }
  const id = uid("p");
  const [post] = await db.insert(postsTable).values({ id, authorId: meId, text, imageKey, category: "general" }).returning();
  const [decorated] = await decoratePosts(meId, [post]);
  res.status(201).json(decorated);
});

router.get("/posts/:id/comments", async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const comments = await db.select().from(commentsTable)
    .where(eq(commentsTable.postId, postId))
    .orderBy(commentsTable.createdAt).limit(limit).offset(offset);

  const userIds = [...new Set(comments.map((c) => c.authorId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}`), sql`, `)}])`)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(comments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    author: userMap.get(c.authorId) ?? null,
  })));
});

router.post("/posts/:id/comments", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const postId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = textBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request payload", code: "INVALID_REQUEST" }); return; }
  const text = parsed.data.text;
  if (!text) { res.status(400).json({ error: "text required" }); return; }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const commentId = uid("cmt");
  await db.transaction(async (tx) => {
    await tx.insert(commentsTable).values({ id: commentId, postId, authorId: meId, text });
    await tx.update(postsTable)
      .set({ commentsCount: sql`${postsTable.commentsCount} + 1` })
      .where(eq(postsTable.id, postId));
  });

  if (post.authorId !== meId) {
    await createNotification({
      userId: post.authorId,
      type: "comment",
      actorId: meId,
      postId,
      message: "commented on your post",
    });
  }

  const [created] = await db.select().from(commentsTable).where(eq(commentsTable.id, commentId));
  const [author] = await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified })
    .from(usersTable).where(eq(usersTable.id, meId));

  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), author: author ?? null });
});

router.post("/posts/:id/like", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) { res.status(400).json({ error: "id required" }); return; }

  let didLike = false;
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(likesTable).where(and(eq(likesTable.postId, id), eq(likesTable.userId, meId)));
    if (existing.length > 0) {
      await tx.delete(likesTable).where(and(eq(likesTable.postId, id), eq(likesTable.userId, meId)));
      await tx.update(postsTable).set({ likesCount: sql`GREATEST(${postsTable.likesCount} - 1, 0)` }).where(eq(postsTable.id, id));
    } else {
      didLike = true;
      await tx.insert(likesTable).values({ postId: id, userId: meId });
      await tx.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} + 1` }).where(eq(postsTable.id, id));
    }
  });
  if (didLike) {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
    if (post) {
      await createNotification({ userId: post.authorId, type: "like", actorId: meId, postId: id, message: "liked your post" });
    }
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  const [decorated] = await decoratePosts(meId, [post]);
  res.json(decorated);
});

router.post("/posts/:id/retweet", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) { res.status(400).json({ error: "id required" }); return; }

  let didRetweet = false;
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(retweetsTable).where(and(eq(retweetsTable.postId, id), eq(retweetsTable.userId, meId)));
    if (existing.length > 0) {
      await tx.delete(retweetsTable).where(and(eq(retweetsTable.postId, id), eq(retweetsTable.userId, meId)));
      await tx.update(postsTable).set({ retweetsCount: sql`GREATEST(${postsTable.retweetsCount} - 1, 0)` }).where(eq(postsTable.id, id));
    } else {
      didRetweet = true;
      await tx.insert(retweetsTable).values({ postId: id, userId: meId });
      await tx.update(postsTable).set({ retweetsCount: sql`${postsTable.retweetsCount} + 1` }).where(eq(postsTable.id, id));
    }
  });
  if (didRetweet) {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
    if (post) {
      await createNotification({ userId: post.authorId, type: "retweet", actorId: meId, postId: id, message: "reposted your post" });
    }
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  const [decorated] = await decoratePosts(meId, [post]);
  res.json(decorated);
});

router.post("/posts/:id/tip", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = amountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request payload", code: "INVALID_REQUEST" }); return; }
  const amount = parsed.data.amount;
  if (!id || !Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    res.status(400).json({ error: "invalid id or amount" }); return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) { res.status(404).json({ error: "Not found" }); return; }

  await db.transaction(async (tx) => {
    await tx.insert(tipsTable).values({ postId: id, fromUserId: meId, toUserId: post.authorId, amount });
    await tx.update(postsTable).set({ tipsTotal: sql`${postsTable.tipsTotal} + ${amount}` }).where(eq(postsTable.id, id));
  });
  await createNotification({ userId: post.authorId, type: "tip", actorId: meId, postId: id, amount, message: `tipped you ${amount} π` });

  const [updated] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  const [decorated] = await decoratePosts(meId, [updated]);
  res.json(decorated);
});

export default router;
