import { Router, type IRouter } from "express";
import { db, markersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/markers", async (_req, res): Promise<void> => {
  const all = await db.select().from(markersTable);
  res.json(all.map((m) => ({ ...m, refId: m.refId ?? null })));
});

export default router;
