import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

function serializeMessage(m: typeof messagesTable.$inferSelect) {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

router.get("/conversations", async (req, res): Promise<void> => {
  const meId = currentUserId(req);

  const rows = await db
    .select()
    .from(messagesTable)
    .where(
      or(eq(messagesTable.fromUserId, meId), eq(messagesTable.toUserId, meId)),
    )
    .orderBy(desc(messagesTable.createdAt));

  const byPeer = new Map<
    string,
    {
      peerId: string;
      lastMessage: typeof messagesTable.$inferSelect;
      unread: number;
    }
  >();

  for (const m of rows) {
    const peerId = m.fromUserId === meId ? m.toUserId : m.fromUserId;
    const existing = byPeer.get(peerId);
    if (!existing) {
      byPeer.set(peerId, {
        peerId,
        lastMessage: m,
        unread: !m.read && m.toUserId === meId ? 1 : 0,
      });
    } else if (!m.read && m.toUserId === meId) {
      existing.unread += 1;
    }
  }

  const peerIds = Array.from(byPeer.keys());
  const users =
    peerIds.length === 0
      ? []
      : await db
          .select()
          .from(usersTable)
          .where(inArray(usersTable.id, peerIds));
  const userById = new Map(users.map((u) => [u.id, u]));

  const conversations = Array.from(byPeer.values())
    .map((c) => {
      const peer = userById.get(c.peerId);
      if (!peer) return null;
      return {
        peerId: c.peerId,
        peer: { ...peer, following: false },
        lastMessage: serializeMessage(c.lastMessage),
        unread: c.unread,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    );

  res.json(conversations);
});

router.get("/conversations/:userId/messages", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const peerId = req.params.userId;

  const peer = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, peerId))
    .limit(1);
  if (peer.length === 0) {
    res.status(404).json({ error: "user not found" });
    return;
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(
      or(
        and(
          eq(messagesTable.fromUserId, meId),
          eq(messagesTable.toUserId, peerId),
        ),
        and(
          eq(messagesTable.fromUserId, peerId),
          eq(messagesTable.toUserId, meId),
        ),
      ),
    )
    .orderBy(messagesTable.createdAt);

  // Mark inbound messages as read
  await db
    .update(messagesTable)
    .set({ read: true })
    .where(
      and(
        eq(messagesTable.fromUserId, peerId),
        eq(messagesTable.toUserId, meId),
        eq(messagesTable.read, false),
      ),
    );

  res.json(rows.map(serializeMessage));
});

router.post(
  "/conversations/:userId/messages",
  async (req, res): Promise<void> => {
    const meId = currentUserId(req);
    const peerId = req.params.userId;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      res.status(400).json({ error: "text required" });
      return;
    }
    if (peerId === meId) {
      res.status(400).json({ error: "cannot message yourself" });
      return;
    }

    const peer = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, peerId))
      .limit(1);
    if (peer.length === 0) {
      res.status(404).json({ error: "user not found" });
      return;
    }

    const [msg] = await db
      .insert(messagesTable)
      .values({
        fromUserId: meId,
        toUserId: peerId,
        text,
      })
      .returning();

    const me = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, meId))
      .limit(1);
    const senderName = me[0]?.name ?? "Someone";

    await createNotification({
      userId: peerId,
      type: "message",
      actorId: meId,
      message: `${senderName} sent you a message`,
    });

    res.status(201).json(serializeMessage(msg));
  },
);

export default router;
