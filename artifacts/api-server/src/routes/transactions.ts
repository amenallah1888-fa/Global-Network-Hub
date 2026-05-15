import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";

const router: IRouter = Router();

router.get("/transactions/me", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, meId))
    .orderBy(desc(transactionsTable.createdAt));
  res.json(txns);
});

export default router;
