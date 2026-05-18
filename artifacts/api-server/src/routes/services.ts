import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, serviceAppsTable, usersTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";

const router: IRouter = Router();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function withProvider(s: typeof serviceAppsTable.$inferSelect, providerMap: Map<string, { id: string; name: string; handle: string; avatarKey: string | null; verified: boolean; city: string }>) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    provider: providerMap.get(s.providerId) ?? null,
  };
}

router.get("/services", async (req, res): Promise<void> => {
  const category = req.query.category as string | undefined;
  const city = req.query.city as string | undefined;

  let rows = await db.select().from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating));
  if (category) rows = rows.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  if (city) rows = rows.filter((s) => s.city?.toLowerCase() === city.toLowerCase());

  const userIds = [...new Set(rows.map((r) => r.providerId))];
  const providers = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city }).from(usersTable)
    : [];
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  res.json(rows.map((s) => withProvider(s, providerMap)));
});

router.get("/services/match", async (req, res): Promise<void> => {
  const needType = (req.query.need as string ?? "").toLowerCase();
  if (!needType) { res.json([]); return; }

  const all = await db.select().from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating));
  const matched = all.filter((s) => s.category.toLowerCase().includes(needType) || s.title.toLowerCase().includes(needType) || s.description.toLowerCase().includes(needType)).slice(0, 3);

  const userIds = [...new Set(matched.map((r) => r.providerId))];
  const providers = userIds.length > 0 ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city }).from(usersTable) : [];
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  res.json(matched.map((s) => withProvider(s, providerMap)));
});

router.get("/services/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [service] = await db.select().from(serviceAppsTable).where(eq(serviceAppsTable.id, id));
  if (!service) { res.status(404).json({ error: "Not found" }); return; }

  const [provider] = await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city, country: usersTable.country, bio: usersTable.bio, title: usersTable.title, company: usersTable.company, followersCount: usersTable.followersCount })
    .from(usersTable).where(eq(usersTable.id, service.providerId));

  const related = await db.select().from(serviceAppsTable)
    .where(eq(serviceAppsTable.category, service.category))
    .orderBy(desc(serviceAppsTable.trustScore)).limit(4);

  const relatedIds = [...new Set(related.map((r) => r.providerId))];
  const relatedProviders = relatedIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city }).from(usersTable)
    : [];
  const relProvMap = new Map(relatedProviders.map((p) => [p.id, p]));

  res.json({
    ...service,
    createdAt: service.createdAt.toISOString(),
    provider: provider ?? null,
    related: related.filter((r) => r.id !== id).slice(0, 3).map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), provider: relProvMap.get(r.providerId) ?? null })),
  });
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
  const [provider] = await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city }).from(usersTable).where(eq(usersTable.id, meId));

  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), provider: provider ?? null });
});

router.post("/services/:id/hire", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [service] = await db.select().from(serviceAppsTable).where(eq(serviceAppsTable.id, id));
  if (!service) { res.status(404).json({ error: "Not found" }); return; }
  if (service.providerId === meId) { res.status(400).json({ error: "Cannot hire yourself" }); return; }

  await db.update(serviceAppsTable).set({ hiredCount: sql`${serviceAppsTable.hiredCount} + 1` }).where(eq(serviceAppsTable.id, id));

  const [updated] = await db.select().from(serviceAppsTable).where(eq(serviceAppsTable.id, id));
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), hiredCount: updated.hiredCount });
});

export default router;
