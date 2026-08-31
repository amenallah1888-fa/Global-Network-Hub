import { Router, type IRouter } from "express";
import { db, markersTable } from "@workspace/db";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

router.get("/markers", async (_req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const all = await db.select().from(markersTable).limit(limit).offset(offset);
  res.json(all.map((m) => ({ ...m, refId: m.refId ?? null })));
});

export default router;
