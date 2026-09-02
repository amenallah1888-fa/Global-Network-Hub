import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, serviceAppsTable, usersTable, auditLogsTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";
import { z } from "@workspace/api-zod";
import { auditLogValues } from "../lib/auditLog";

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

const MOCK_SERVICES = [
  { id: "mock_svc_1", providerId: "system", title: "Smart Contract Auditing", category: "Development", description: "Comprehensive security audits for Pi-native smart contracts and dApps. Certified blockchain security experts with 5+ years on Pi Network.", pricePi: 500, city: "Remote", country: "Global", portfolioUrl: null, trustScore: 100, hiredCount: 47, rating: 5, createdAt: new Date().toISOString(), provider: { id: "system", name: "Pi Security Labs", handle: "piseclabs", avatarKey: null, verified: true, city: "Remote" } },
  { id: "mock_svc_2", providerId: "system", title: "Pi App UI/UX Design", category: "Design", description: "Full product design for Pi ecosystem apps. Figma prototypes, user research, accessibility audits, and handoff-ready design systems.", pricePi: 200, city: "Tunis", country: "Tunisia", portfolioUrl: null, trustScore: 95, hiredCount: 31, rating: 5, createdAt: new Date().toISOString(), provider: { id: "system", name: "DesignPi Studio", handle: "designpi", avatarKey: null, verified: true, city: "Tunis" } },
  { id: "mock_svc_3", providerId: "system", title: "Pi Network Marketing", category: "Marketing", description: "Growth hacking and community building for Pi projects. Telegram, Twitter/X, and Pi Chat campaigns. Proven results with 10x engagement uplift.", pricePi: 150, city: "Lagos", country: "Nigeria", portfolioUrl: null, trustScore: 92, hiredCount: 62, rating: 4, createdAt: new Date().toISOString(), provider: { id: "system", name: "GrowPi Agency", handle: "growpi", avatarKey: null, verified: true, city: "Lagos" } },
  { id: "mock_svc_4", providerId: "system", title: "Legal Entity Formation", category: "Legal", description: "Register your Pi-backed startup in UAE, UK, or USA. Full legal package: formation, contracts, IP registration, and compliance guidance.", pricePi: 350, city: "Dubai", country: "UAE", portfolioUrl: null, trustScore: 88, hiredCount: 18, rating: 5, createdAt: new Date().toISOString(), provider: { id: "system", name: "Pi Legal Group", handle: "pilegal", avatarKey: null, verified: true, city: "Dubai" } },
  { id: "mock_svc_5", providerId: "system", title: "Backend API Development", category: "Development", description: "Node.js / Express / PostgreSQL backends for Pi apps. REST and WebSocket APIs, Drizzle ORM, cloud deployment, 99.9% uptime SLA.", pricePi: 300, city: "Nairobi", country: "Kenya", portfolioUrl: null, trustScore: 97, hiredCount: 55, rating: 5, createdAt: new Date().toISOString(), provider: { id: "system", name: "CodeForge Pi", handle: "codeforgepi", avatarKey: null, verified: true, city: "Nairobi" } },
  { id: "mock_svc_6", providerId: "system", title: "Pitch Deck & Copywriting", category: "Copywriting", description: "Professional pitch decks, white papers, and investor materials tailored for Pi Network fundraising and ecosystem presentations.", pricePi: 120, city: "Cairo", country: "Egypt", portfolioUrl: null, trustScore: 90, hiredCount: 39, rating: 4, createdAt: new Date().toISOString(), provider: { id: "system", name: "Pi Content Co.", handle: "picontentco", avatarKey: null, verified: true, city: "Cairo" } },
];

router.get("/services", async (req, res): Promise<void> => {
  const category = req.query.category as string | undefined;
  const city = req.query.city as string | undefined;
  const { limit, offset } = getPagination(res);

  let rows = await db.select().from(serviceAppsTable)
    .orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating))
    .limit(limit).offset(offset);
  if (category) rows = rows.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  if (city) rows = rows.filter((s) => s.city?.toLowerCase() === city.toLowerCase());

  if (rows.length === 0 && !category && !city) {
    res.json(MOCK_SERVICES.slice(offset, offset + limit)); return;
  }

  const userIds = [...new Set(rows.map((r) => r.providerId))];
  const providers = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city }).from(usersTable)
    : [];
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  res.json(rows.map((s) => withProvider(s, providerMap)));
});

router.get("/services/match", async (req, res): Promise<void> => {
  const needType = (req.query.need as string ?? "").toLowerCase();
  const { limit, offset } = getPagination(res);
  if (!needType) { res.json([]); return; }

  const all = await db.select().from(serviceAppsTable)
    .orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating))
    .limit(limit + offset);
  const matched = all.filter((s) => s.category.toLowerCase().includes(needType) || s.title.toLowerCase().includes(needType) || s.description.toLowerCase().includes(needType)).slice(offset, offset + limit);

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
    ? await db.select({ id: usersTable.id, name: usersTable.name, handle: usersTable.handle, avatarKey: usersTable.avatarKey, verified: usersTable.verified, city: usersTable.city })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(relatedIds.map((uid) => sql`${uid}`), sql`, `)}])`)
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
  const parsed = z.object({
    title: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(5000),
    pricePi: z.coerce.number().int().min(0).max(10_000_000),
    city: z.string().trim().max(120).nullable().optional(),
    country: z.string().trim().max(120).nullable().optional(),
    portfolioUrl: z.string().url().max(2000).nullable().optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "title, category, description, pricePi required" }); return;
  }
  const { title, category, description, pricePi } = parsed.data;
  const city = parsed.data.city?.trim() || null;
  const country = parsed.data.country?.trim() || null;
  const portfolioUrl = parsed.data.portfolioUrl?.trim() || null;

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, meId));
  if (!me || me.kycStatus !== "verified") {
    res.status(403).json({ error: "KYC verification required to offer a Service. Complete identity verification first.", code: "KYC_REQUIRED" }); return;
  }
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
  let service: typeof serviceAppsTable.$inferSelect | undefined;
  await db.transaction(async (tx) => {
    const [lockedService] = await tx.select().from(serviceAppsTable)
      .where(eq(serviceAppsTable.id, id))
      .for("update");
    if (!lockedService) return;
    service = lockedService;
    if (lockedService.providerId === meId) {
      res.status(400).json({ error: "Cannot hire yourself" });
      return;
    }
    const updated = await tx.update(serviceAppsTable)
      .set({ hiredCount: sql`${serviceAppsTable.hiredCount} + 1` })
      .where(eq(serviceAppsTable.id, id))
      .returning({ id: serviceAppsTable.id });
    if (updated.length !== 1) return;
    await tx.insert(auditLogsTable).values(auditLogValues({
      entityType: "financial",
      entityId: id,
      actorId: meId,
      action: "SERVICE_HIRED",
      metadata: { serviceId: id, pricePi: lockedService.pricePi },
      req,
    }));
  });
  if (!service) { res.status(404).json({ error: "Not found" }); return; }
  if (res.headersSent) return;

  const [updated] = await db.select().from(serviceAppsTable).where(eq(serviceAppsTable.id, id));
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), hiredCount: updated.hiredCount });
});

export default router;
