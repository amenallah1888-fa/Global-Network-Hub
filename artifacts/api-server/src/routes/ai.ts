import { Router, type IRouter } from "express";
import { desc, sql, eq, and } from "drizzle-orm";
import { db, pitchesTable, markersTable, usersTable, serviceAppsTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { cache, TTL } from "../lib/cache";
import Groq from "groq-sdk";

const MODEL = "llama-3.3-70b-versatile";

function createGroqClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

const groq = createGroqClient();
const router: IRouter = Router();

async function buildEcosystemContext(): Promise<string> {
  const cacheKey = "ecosystem_context";
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  try {
    const [pitchStats] = await db.select({
      count: sql<number>`count(*)::int`,
      totalRaised: sql<number>`coalesce(sum(raised),0)::bigint`,
    }).from(pitchesTable);

    const topFunded = await db.select({
      id: pitchesTable.id,
      title: pitchesTable.title,
      raised: pitchesTable.raised,
      raising: pitchesTable.raising,
      city: pitchesTable.city,
      industry: pitchesTable.industry,
      stage: pitchesTable.stage,
      backersCount: pitchesTable.backersCount,
      trustScore: pitchesTable.trustScore,
    }).from(pitchesTable).orderBy(desc(pitchesTable.raised)).limit(8);

    const trendingCities = await db.select({
      city: markersTable.city,
      count: sql<number>`count(*)::int`,
    }).from(markersTable).groupBy(markersTable.city).orderBy(sql`count(*) desc`).limit(5);

    const services = await db.select({
      id: serviceAppsTable.id,
      title: serviceAppsTable.title,
      category: serviceAppsTable.category,
      city: serviceAppsTable.city,
      trustScore: serviceAppsTable.trustScore,
      rating: serviceAppsTable.rating,
      hiredCount: serviceAppsTable.hiredCount,
      description: serviceAppsTable.description,
    }).from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore), desc(serviceAppsTable.rating)).limit(10);

    const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

    const topUsers = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      handle: usersTable.handle,
      city: usersTable.city,
      reputationScore: usersTable.reputationScore,
      kycStatus: usersTable.kycStatus,
    }).from(usersTable).orderBy(desc(usersTable.reputationScore)).limit(5);

    const ctx = `
HUMANVERSE ECOSYSTEM DATA (live):
- Total projects: ${pitchStats?.count ?? 0} | Total Pi raised: ${pitchStats?.totalRaised ?? 0} π | Total users: ${totalUsers?.count ?? 0}

TOP FUNDED PROJECTS (search these when users ask about pitches/startups):
${topFunded.map((p, i) => `${i + 1}. ID:${p.id} "${p.title}" (${p.city}) — ${p.raised}π raised, ${p.backersCount} backers, ${p.industry}, ${p.stage}, trust:${p.trustScore ?? 0}%`).join("\n")}

AVAILABLE SERVICES (search these when users ask for help, skills, or providers):
${services.map((s, i) => `${i + 1}. ID:${s.id} "${s.title}" [${s.category}] ${s.city} — ${s.trustScore}/100 trust, ${s.rating}/5 rating, ${s.hiredCount} hired — ${s.description?.slice(0, 60)}…`).join("\n")}

TOP REPUTATION USERS (suggest for collaboration or validation):
${topUsers.map((u) => `@${u.handle} (${u.city}) score:${u.reputationScore} kyc:${u.kycStatus}`).join(" | ")}

TRENDING CITIES: ${trendingCities.map((c) => `${c.city}(${c.count})`).join(", ")}
`.trim();

    cache.set(cacheKey, ctx, TTL.MEDIUM);
    return ctx;
  } catch {
    return "Ecosystem data temporarily unavailable.";
  }
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const messages: { role: string; content: string }[] = req.body?.messages ?? [];
  const pitchContext: Record<string, unknown> | null = req.body?.pitchContext ?? null;

  if (!messages.length) { res.status(400).json({ error: "messages required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!groq) {
    const mock = "The HumanVerse AI assistant is ready — add a GROQ_API_KEY secret to activate it. Get your free key at console.groq.com.";
    for (const char of mock) res.write(`data: ${JSON.stringify({ content: char })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  const ecosystemContext = await buildEcosystemContext();

  let pitchSection = "";
  if (pitchContext) {
    pitchSection = `
CURRENT PROJECT CONTEXT (user is viewing this project):
- Title: ${pitchContext.title} | City: ${pitchContext.city} | Industry: ${pitchContext.industry} | Stage: ${pitchContext.stage}
- Raised: ${pitchContext.raised} π of ${pitchContext.raising} π | Backers: ${pitchContext.backersCount} | Verified: ${pitchContext.verified ? "Yes" : "No"}
- Roadmap: ${pitchContext.roadmapUrl ?? "Not provided"} | Proof: ${pitchContext.proofOfRealityUrl ?? "Not provided"}
`.trim();
  }

  const systemPrompt = `You are HumanVerse Intelligence, the AI assistant and Broker for HumanVerse — a social business super app on the Pi Network.

You act as a smart broker: when users ask about projects, services, skills, or people, you MUST search the ecosystem data above and suggest specific entities by name, referencing their IDs so the app can deep-link. Format suggestions as:
• 🔗 [Title](id:ENTITY_ID) — brief reason

All currency is Pi (π). Never mention dollars unless asked.

${ecosystemContext}

${pitchSection ? pitchSection + "\n" : ""}Rules:
- Be concise (3-5 sentences max unless asked for detail)
- Use bullets when listing. Reference IDs when suggesting specific entities.
- Never hallucinate — only use data provided above
- If asked to find something not in the data, acknowledge the limit
- For matchmaking: extract keywords from the user's request, match against categories/industries/titles in the data`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    const stream = await groq.chat.completions.create({ model: MODEL, max_tokens: 8192, messages: chatMessages, stream: true });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable. Please try again." })}\n\n`);
    res.end();
  }
});

router.post("/ai/matchmaker", async (req, res): Promise<void> => {
  currentUserId(req);
  const query = String(req.body?.query ?? "").toLowerCase().trim();
  const type = req.body?.type as "service" | "pitch" | "any" ?? "any";

  if (!query) { res.status(400).json({ error: "query required" }); return; }

  const terms = query.split(/\s+/).filter((t) => t.length > 2);

  const results: { type: string; id: string; title: string; score: number; meta: string }[] = [];

  if (type !== "pitch") {
    const services = await db.select({
      id: serviceAppsTable.id, title: serviceAppsTable.title, category: serviceAppsTable.category,
      city: serviceAppsTable.city, trustScore: serviceAppsTable.trustScore, rating: serviceAppsTable.rating,
      description: serviceAppsTable.description,
    }).from(serviceAppsTable).orderBy(desc(serviceAppsTable.trustScore)).limit(30);

    for (const svc of services) {
      const haystack = `${svc.title} ${svc.category} ${svc.description ?? ""} ${svc.city}`.toLowerCase();
      let matchScore = 0;
      for (const term of terms) { if (haystack.includes(term)) matchScore += 2; }
      matchScore += (svc.trustScore ?? 0) / 50;
      matchScore += (svc.rating ?? 0) / 5;
      if (matchScore > 1) results.push({ type: "service", id: svc.id, title: svc.title, score: matchScore, meta: `${svc.category} · ${svc.city} · ${svc.trustScore}/100` });
    }
  }

  if (type !== "service") {
    const pitches = await db.select({
      id: pitchesTable.id, title: pitchesTable.title, industry: pitchesTable.industry,
      city: pitchesTable.city, stage: pitchesTable.stage, raised: pitchesTable.raised,
      summary: pitchesTable.summary, trustScore: pitchesTable.trustScore,
    }).from(pitchesTable).orderBy(desc(pitchesTable.raised)).limit(30);

    for (const p of pitches) {
      const haystack = `${p.title} ${p.industry} ${p.summary ?? ""} ${p.city} ${p.stage}`.toLowerCase();
      let matchScore = 0;
      for (const term of terms) { if (haystack.includes(term)) matchScore += 2; }
      matchScore += (p.trustScore ?? 0) / 50;
      if (matchScore > 1) results.push({ type: "pitch", id: p.id, title: p.title, score: matchScore, meta: `${p.industry} · ${p.stage} · ${p.raised}π raised` });
    }
  }

  results.sort((a, b) => b.score - a.score);
  res.json({ query, results: results.slice(0, 8) });
});

router.post("/ai/mastermind-match", async (req, res): Promise<void> => {
  currentUserId(req);
  const challenge = String(req.body?.challenge ?? "").trim();
  const targetSize = Math.min(8, Math.max(3, parseInt(String(req.body?.targetSize ?? "6"), 10)));

  const allUsers = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    handle: usersTable.handle,
    title: usersTable.title,
    city: usersTable.city,
    bio: usersTable.bio,
    reputationScore: usersTable.reputationScore,
    kycStatus: usersTable.kycStatus,
  }).from(usersTable)
    .where(and(eq(usersTable.kycStatus, "verified"), sql`${usersTable.reputationScore} > 0`))
    .orderBy(desc(usersTable.reputationScore))
    .limit(50);

  if (allUsers.length < 3) {
    res.json({ message: "Not enough verified users yet for mastermind matching", users: [], challenge: challenge || null }); return;
  }

  const terms = challenge.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const scored = allUsers.map((u) => {
    const haystack = `${u.title} ${u.bio} ${u.city}`.toLowerCase();
    let score = u.reputationScore;
    for (const term of terms) { if (haystack.includes(term)) score += 20; }
    return { ...u, matchScore: score };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const selected = scored.slice(0, targetSize);

  const roles = ["Dev", "Designer", "Marketer", "Legal", "Finance", "Product", "Founder", "Advisor"];
  const grouped = selected.map((u, i) => ({ ...u, suggestedRole: roles[i % roles.length] }));

  const circleName = `Mastermind: ${challenge ? challenge.slice(0, 40) : "Open Innovation"} (48h)`;
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

  const aiChallenge = challenge || "What is the single biggest opportunity in the Pi Network ecosystem right now, and what would you build to capture it in 30 days?";

  res.json({
    circleName,
    challenge: aiChallenge,
    expiresAt: expiresAt.toISOString(),
    memberCount: grouped.length,
    members: grouped.map(({ matchScore, ...u }) => u),
    instructions: "Use POST /circles to create this circle with the suggested members and inject the challenge as the first message.",
  });
});

export default router;
