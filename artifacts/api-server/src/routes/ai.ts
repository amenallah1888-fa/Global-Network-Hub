import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, pitchesTable, markersTable, usersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/ai/chat", async (req, res): Promise<void> => {
  const messages: { role: string; content: string }[] = req.body?.messages ?? [];
  const pitchContext: Record<string, unknown> | null = req.body?.pitchContext ?? null;

  if (!messages.length) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  let ecosystemContext = "";
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
    }).from(pitchesTable)
      .orderBy(desc(pitchesTable.raised))
      .limit(5);

    const trendingCities = await db.select({
      city: markersTable.city,
      count: sql<number>`count(*)::int`,
    }).from(markersTable)
      .groupBy(markersTable.city)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const serviceApps = await db.select({
      title: pitchesTable.title,
      city: pitchesTable.city,
      industry: pitchesTable.industry,
    }).from(pitchesTable)
      .where(sql`${pitchesTable.entityType} = 'service_app'`)
      .orderBy(desc(pitchesTable.createdAt))
      .limit(8);

    const totalUsers = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

    ecosystemContext = `
HUMANVERSE ECOSYSTEM DATA (live):
- Total projects on platform: ${pitchStats?.count ?? 0}
- Total Pi raised across all projects: ${pitchStats?.totalRaised ?? 0} π
- Total users: ${totalUsers[0]?.count ?? 0}

TOP 5 MOST FUNDED PROJECTS:
${topFunded.map((p, i) => `${i + 1}. "${p.title}" (${p.city}) — ${p.raised} π raised of ${p.raising} π goal, ${p.backersCount} backers, ${p.industry}, ${p.stage}`).join("\n")}

TRENDING CITIES ON THE ATLAS:
${trendingCities.map((c, i) => `${i + 1}. ${c.city} (${c.count} markers)`).join(", ")}

LATEST SERVICE APPS:
${serviceApps.map((s) => `"${s.title}" in ${s.city} (${s.industry})`).join(", ")}
`.trim();
  } catch {
    ecosystemContext = "Ecosystem data temporarily unavailable.";
  }

  let pitchSection = "";
  if (pitchContext) {
    pitchSection = `
CURRENT PROJECT CONTEXT (user is viewing this project):
- Title: ${pitchContext.title}
- Summary: ${pitchContext.summary}
- City: ${pitchContext.city}
- Industry: ${pitchContext.industry}
- Stage: ${pitchContext.stage}
- Raised: ${pitchContext.raised} π of ${pitchContext.raising} π
- Backers: ${pitchContext.backersCount}
- Verified: ${pitchContext.verified ? "Yes" : "No"}
- Roadmap: ${pitchContext.roadmapUrl ?? "Not provided"}
- Proof of Reality: ${pitchContext.proofOfRealityUrl ?? "Not provided"}
`.trim();
  }

  const systemPrompt = `You are HumanVerse Intelligence, the AI assistant embedded in HumanVerse — a social business super app built on the Pi Network ecosystem. You help users discover projects, evaluate investments, find services, and navigate the ecosystem.

You communicate in a concise, confident, and human tone — similar to Grok on X. You are helpful, direct, and sometimes witty.

All currency in HumanVerse is Pi (π). Never mention dollars or other currencies unless specifically asked.

${ecosystemContext}

${pitchSection ? pitchSection + "\n" : ""}Rules:
- Keep responses concise (3-5 sentences max unless asked for detail)
- Use bullet points when listing items
- Never hallucinate data — use only the ecosystem data provided above
- If asked to analyze a project, base it on the current project context if available
- If asked about something not in the data, say you'll have more data as the ecosystem grows`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable. Please try again." })}\n\n`);
    res.end();
  }
});

export default router;
