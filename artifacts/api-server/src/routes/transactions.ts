import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

router.get("/transactions/me", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const { limit, offset } = getPagination(res);
  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, meId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);
  res.json(txns);
});

export default router;
