import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  circlesTable,
  circleMembersTable,
  circleJoinRequestsTable,
  circleAnnouncementsTable,
  circleChatMessagesTable,
  circleEventsTable,
  usersTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function isAdmin(circle: { founderIds: string[] }, userId: string) {
  return circle.founderIds.includes(userId);
}

router.get("/circles", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const { limit, offset } = getPagination(res);
  const all = await db.select().from(circlesTable).limit(limit).offset(offset);
  const mine = await db
    .select()
    .from(circleMembersTable)
    .where(eq(circleMembersTable.userId, meId));
  const set = new Set(mine.map((m) => m.circleId));
  res.json(
    all.map((c) => ({
      ...c,
      coverKey: c.coverKey ?? null,
      coverUrl: c.coverUrl ?? null,
      rules: c.rules ?? null,
      joined: set.has(c.id),
    })),
  );
});

router.post("/circles", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};
  const name = String(body.name ?? "").trim();
  const about = String(body.about ?? "").trim();
  const category = String(body.category ?? "General").trim();
  const rules = typeof body.rules === "string" && body.rules.trim() ? body.rules.trim() : null;
  const coverUrl = typeof body.coverUrl === "string" && body.coverUrl.trim() ? body.coverUrl.trim() : null;
  const paid = !!body.paid;
  const inviteOnly = !!body.inviteOnly;
  const price = paid ? Math.max(0, parseInt(String(body.price ?? "0"), 10)) : 0;

  if (!name || !about) {
    res.status(400).json({ error: "Name and description are required" });
    return;
  }

  const id = uid("ci");
  const COLORS = ["#D4AF7A", "#6C63FF", "#22C55E", "#F97316", "#3B82F6", "#EC4899"];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  await db.insert(circlesTable).values({
    id,
    name,
    about,
    category,
    rules,
    coverUrl,
    color,
    paid,
    inviteOnly,
    price,
    membersCount: 1,
    activeNow: 1,
    founderIds: [meId],
  });

  await db.insert(circleMembersTable).values({
    circleId: id,
    userId: meId,
    paid: false,
    role: "admin",
  });

  const [created] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  res.status(201).json({ ...created, coverKey: null, coverUrl: created.coverUrl ?? null, rules: created.rules ?? null, joined: true });
});

router.get("/circles/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  const [membership] = await db.select().from(circleMembersTable).where(
    and(eq(circleMembersTable.circleId, id), eq(circleMembersTable.userId, meId)),
  );
  res.json({
    ...circle,
    coverKey: circle.coverKey ?? null,
    coverUrl: circle.coverUrl ?? null,
    rules: circle.rules ?? null,
    joined: !!membership,
    role: membership?.role ?? null,
    isAdmin: isAdmin(circle, meId),
  });
});

router.patch("/circles/:id", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }

  const body = req.body ?? {};
  const updates: Partial<typeof circlesTable.$inferInsert> = {};
  if (typeof body.about === "string" && body.about.trim()) updates.about = body.about.trim();
  if (typeof body.rules === "string") updates.rules = body.rules.trim() || null;
  if (typeof body.price === "number") updates.price = Math.max(0, body.price);

  if (Object.keys(updates).length > 0) {
    await db.update(circlesTable).set(updates).where(eq(circlesTable.id, id));
  }
  const [updated] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  res.json({ ...updated, coverKey: updated.coverKey ?? null, coverUrl: updated.coverUrl ?? null, rules: updated.rules ?? null, isAdmin: true, joined: true });
});

router.post("/circles/:id/membership", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) { res.status(400).json({ error: "id required" }); return; }

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }

  const existing = await db.select().from(circleMembersTable).where(
    and(eq(circleMembersTable.circleId, id), eq(circleMembersTable.userId, meId)),
  );

  let joined: boolean;
  let pending = false;

  if (existing.length > 0) {
    if (isAdmin(circle, meId)) { res.status(400).json({ error: "Founder cannot leave" }); return; }
    await db.delete(circleMembersTable).where(
      and(eq(circleMembersTable.circleId, id), eq(circleMembersTable.userId, meId)),
    );
    await db.update(circlesTable)
      .set({ membersCount: sql`GREATEST(${circlesTable.membersCount} - 1, 0)` })
      .where(eq(circlesTable.id, id));
    joined = false;
  } else if (circle.paid || circle.inviteOnly) {
    const existingReq = await db.select().from(circleJoinRequestsTable).where(
      and(eq(circleJoinRequestsTable.circleId, id), eq(circleJoinRequestsTable.userId, meId)),
    );
    if (existingReq.length === 0) {
      await db.insert(circleJoinRequestsTable).values({ circleId: id, userId: meId, status: "pending" });
      for (const founderId of circle.founderIds) {
        await createNotification({
          userId: founderId,
          type: "circle_request",
          actorId: meId,
          circleId: id,
          message: `requested to join "${circle.name}"`,
        });
      }
    }
    joined = false;
    pending = true;
  } else {
    await db.insert(circleMembersTable).values({ circleId: id, userId: meId, paid: false, role: "member" });
    await db.update(circlesTable)
      .set({ membersCount: sql`${circlesTable.membersCount} + 1` })
      .where(eq(circlesTable.id, id));
    joined = true;

    for (const founderId of circle.founderIds) {
      await createNotification({
        userId: founderId,
        type: "circle_join",
        actorId: meId,
        circleId: id,
        message: `joined your circle "${circle.name}"`,
      });
    }
  }

  const [updated] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  res.json({ ...updated, coverKey: updated.coverKey ?? null, coverUrl: updated.coverUrl ?? null, rules: updated.rules ?? null, joined, pending });
});

router.get("/circles/:id/members", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const members = await db.select().from(circleMembersTable).where(eq(circleMembersTable.circleId, id)).limit(limit).offset(offset);
  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) { res.json([]); return; }
  const users = await db.select().from(usersTable)
    .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map((uid2) => sql`${uid2}`), sql`, `)}])`);
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(members.map((m) => ({ ...m, user: userMap.get(m.userId) ?? null })));
});

router.get("/circles/:id/requests", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }

  const requests = await db.select().from(circleJoinRequestsTable)
    .where(and(eq(circleJoinRequestsTable.circleId, id), eq(circleJoinRequestsTable.status, "pending")))
    .limit(limit).offset(offset);
  const userIds = requests.map((r) => r.userId);
  if (userIds.length === 0) { res.json([]); return; }
  const users = await db.select().from(usersTable)
    .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map((uid2) => sql`${uid2}`), sql`, `)}])`);
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(requests.map((r) => ({ ...r, user: userMap.get(r.userId) ?? null })));
});

router.post("/circles/:id/requests/:userId/approve", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }

  await db.update(circleJoinRequestsTable)
    .set({ status: "approved" })
    .where(and(eq(circleJoinRequestsTable.circleId, id), eq(circleJoinRequestsTable.userId, targetUserId)));

  const existingMember = await db.select().from(circleMembersTable).where(
    and(eq(circleMembersTable.circleId, id), eq(circleMembersTable.userId, targetUserId)),
  );
  if (existingMember.length === 0) {
    await db.insert(circleMembersTable).values({ circleId: id, userId: targetUserId, paid: circle.paid, role: "member" });
    await db.update(circlesTable)
      .set({ membersCount: sql`${circlesTable.membersCount} + 1`,
             poolBalance: circle.paid ? sql`${circlesTable.poolBalance} + ${circle.price}` : circlesTable.poolBalance })
      .where(eq(circlesTable.id, id));
    await createNotification({
      userId: targetUserId,
      type: "circle_invite",
      circleId: id,
      message: `You've been approved to join "${circle.name}"`,
    });
  }
  res.json({ approved: true });
});

router.post("/circles/:id/requests/:userId/reject", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }

  await db.update(circleJoinRequestsTable)
    .set({ status: "rejected" })
    .where(and(eq(circleJoinRequestsTable.circleId, id), eq(circleJoinRequestsTable.userId, targetUserId)));
  res.json({ rejected: true });
});

router.delete("/circles/:id/members/:userId", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }
  if (targetUserId === meId) { res.status(400).json({ error: "Cannot remove yourself" }); return; }

  await db.delete(circleMembersTable).where(
    and(eq(circleMembersTable.circleId, id), eq(circleMembersTable.userId, targetUserId)),
  );
  await db.update(circlesTable)
    .set({ membersCount: sql`GREATEST(${circlesTable.membersCount} - 1, 0)` })
    .where(eq(circlesTable.id, id));
  res.json({ removed: true });
});

router.get("/circles/:id/announcements", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const items = await db.select().from(circleAnnouncementsTable)
    .where(eq(circleAnnouncementsTable.circleId, id))
    .orderBy(desc(circleAnnouncementsTable.createdAt)).limit(limit).offset(offset);
  res.json(items);
});

router.post("/circles/:id/announcements", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }

  const content = String(req.body?.content ?? "").trim();
  if (!content) { res.status(400).json({ error: "Content required" }); return; }

  const annoId = uid("ann");
  await db.insert(circleAnnouncementsTable).values({ id: annoId, circleId: id, authorId: meId, content, pinned: true });
  const [created] = await db.select().from(circleAnnouncementsTable).where(eq(circleAnnouncementsTable.id, annoId));
  res.status(201).json(created);
});

router.get("/circles/:id/chat", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const messages = await db.select().from(circleChatMessagesTable)
    .where(eq(circleChatMessagesTable.circleId, id))
    .orderBy(desc(circleChatMessagesTable.createdAt))
    .limit(limit).offset(offset);

  const userIds = [...new Set(messages.map((m) => m.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, avatarKey: usersTable.avatarKey, handle: usersTable.handle })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map((uid2) => sql`${uid2}`), sql`, `)}])`)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(messages.reverse().map((m) => ({ ...m, user: userMap.get(m.userId) ?? null })));
});

router.post("/circles/:id/chat", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const membership = await db.select().from(circleMembersTable).where(
    and(eq(circleMembersTable.circleId, id), eq(circleMembersTable.userId, meId)),
  );
  if (membership.length === 0) { res.status(403).json({ error: "Not a member" }); return; }

  const text = String(req.body?.text ?? "").trim();
  if (!text) { res.status(400).json({ error: "Message text required" }); return; }

  const msgId = uid("msg");
  await db.insert(circleChatMessagesTable).values({ id: msgId, circleId: id, userId: meId, text });
  const [created] = await db.select().from(circleChatMessagesTable).where(eq(circleChatMessagesTable.id, msgId));
  const [me] = await db.select({ id: usersTable.id, name: usersTable.name, avatarKey: usersTable.avatarKey, handle: usersTable.handle })
    .from(usersTable).where(eq(usersTable.id, meId));
  res.status(201).json({ ...created, user: me ?? null });
});

router.get("/circles/:id/events", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit, offset } = getPagination(res);
  const events = await db.select().from(circleEventsTable)
    .where(eq(circleEventsTable.circleId, id))
    .orderBy(circleEventsTable.scheduledAt).limit(limit).offset(offset);
  res.json(events);
});

router.post("/circles/:id/events", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin(circle, meId)) { res.status(403).json({ error: "Not an admin" }); return; }

  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;
  if (!title || !scheduledAt) { res.status(400).json({ error: "Title and scheduledAt required" }); return; }

  const evtId = uid("evt");
  await db.insert(circleEventsTable).values({ id: evtId, circleId: id, creatorId: meId, title, description, scheduledAt });
  const [created] = await db.select().from(circleEventsTable).where(eq(circleEventsTable.id, evtId));
  res.status(201).json(created);
});

export default router;
