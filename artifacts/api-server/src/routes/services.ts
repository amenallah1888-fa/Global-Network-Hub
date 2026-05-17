import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, serviceAppsTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

router.get("/services", async (req, res): Promise<void> => {
  const category = req.query.category as string | undefined;
  const city = req.query.city as string | undefined;

  let query = db.select().from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating));

  let rows = await query;
  if (category) rows = rows.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  if (city) rows = rows.filter((s) => s.city?.toLowerCase() === city.toLowerCase());

  const userIds = [...new Set(rows.map((r) => r.providerId))];
  const providers = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city })
        .from(usersTable)
    : [];
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  res.json(rows.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    provider: providerMap.get(s.providerId) ?? null,
  })));
});

router.post("/services", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};

  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim();
  const description = String(body.description ?? "").trim();
  const pricePi = parseInt(String(body.pricePi ?? "0"), 10);
  const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;
  const country = typeof body.country === "string" && body.country.trim() ? body.country.trim() : null;
  const portfolioUrl = typeof body.portfolioUrl === "string" && body.portfolioUrl.trim() ? body.portfolioUrl.trim() : null;

  if (!title || !category || !description || pricePi < 0) {
    res.status(400).json({ error: "title, category, description, pricePi required" }); return;
  }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  const trustScore = me?.verified ? 80 : 40;

  const id = uid("svc");
  await db.insert(serviceAppsTable).values({ id, providerId: meId, title, category, description, pricePi, city, country, portfolioUrl, trustScore });

  const [created] = await db.select().from(serviceAppsTable).where(eq(serviceAppsTable.id, id));
  const [provider] = await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city })
    .from(usersTable).where(eq(usersTable.id, meId));

  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), provider: provider ?? null });
});

router.get("/services/match", async (req, res): Promise<void> => {
  const needType = (req.query.need as string ?? "").toLowerCase();
  if (!needType) { res.json([]); return; }

  const all = await db.select().from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating));
  const matched = all.filter((s) => s.category.toLowerCase().includes(needType) || s.title.toLowerCase().includes(needType) || s.description.toLowerCase().includes(needType)).slice(0, 3);

  const userIds = [...new Set(matched.map((r) => r.providerId))];
  const providers = userIds.length > 0 ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified }).from(usersTable) : [];
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  res.json(matched.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), provider: providerMap.get(s.providerId) ?? null })));
});

export default router;
