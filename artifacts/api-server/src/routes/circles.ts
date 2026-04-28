import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  circlesTable,
  circleMembersTable,
  usersTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

router.get("/circles", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const all = await db.select().from(circlesTable);
  const mine = await db
    .select()
    .from(circleMembersTable)
    .where(eq(circleMembersTable.userId, meId));
  const set = new Set(mine.map((m) => m.circleId));
  res.json(
    all.map((c) => ({
      ...c,
      coverKey: c.coverKey ?? null,
      joined: set.has(c.id),
    })),
  );
});

router.post("/circles/:id/membership", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }

  const [circle] = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, id));
  if (!circle) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const existing = await db
    .select()
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, id),
        eq(circleMembersTable.userId, meId),
      ),
    );

  let joined: boolean;
  if (existing.length > 0) {
    await db
      .delete(circleMembersTable)
      .where(
        and(
          eq(circleMembersTable.circleId, id),
          eq(circleMembersTable.userId, meId),
        ),
      );
    await db
      .update(circlesTable)
      .set({ membersCount: sql`GREATEST(${circlesTable.membersCount} - 1, 0)` })
      .where(eq(circlesTable.id, id));
    joined = false;
  } else {
    await db
      .insert(circleMembersTable)
      .values({ circleId: id, userId: meId, paid: circle.paid });
    await db
      .update(circlesTable)
      .set({ membersCount: sql`${circlesTable.membersCount} + 1` })
      .where(eq(circlesTable.id, id));
    joined = true;

    // Notify founders
    for (const founderId of circle.founderIds) {
      await createNotification({
        userId: founderId,
        type: "circle_join",
        actorId: meId,
        circleId: id,
        amount: circle.paid ? circle.price : undefined,
        message: circle.paid
          ? `joined ${circle.name} ($${circle.price}/mo)`
          : `joined your circle "${circle.name}"`,
      });
    }
    // Self confirmation
    if (circle.paid) {
      const [me] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, meId));
      if (me) {
        await createNotification({
          userId: meId,
          type: "circle_invite",
          circleId: id,
          amount: circle.price,
          message: `Welcome to ${circle.name} — your $${circle.price}/mo membership is active.`,
        });
      }
    }
  }

  const [updated] = await db
    .select()
    .from(circlesTable)
    .where(eq(circlesTable.id, id));
  res.json({ ...updated, coverKey: updated.coverKey ?? null, joined });
});

export default router;
