import { Router, type IRouter } from "express";
import { desc, eq, sql, and, inArray } from "drizzle-orm";
import Groq from "groq-sdk";
import {
  db,
  coFounderSessionsTable,
  milestoneAuditsTable,
  pitchesTable,
  milestonesTable,
  transactionsTable,
  proposalsTable,
} from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { aiRateLimiter } from "../lib/rateLimit";

const CHAT_MODEL = "llama-3.3-70b-versatile";
const FAST_MODEL = "llama-3.1-8b-instant";

function createGroqClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

const groq = createGroqClient();
const router: IRouter = Router();
router.use("/ai", aiRateLimiter);

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function extractJson<T>(raw: string): T | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

type CoFounderDraft = {
  title?: string;
  summary?: string;
  industry?: string;
  stage?: string;
  raising?: number;
  milestones?: { title: string; description: string; percentageOfFunds: number }[];
};

type CoFounderOptimized = {
  title: string;
  summary: string;
  raising: number;
  budgetNotes: string;
  milestones: { title: string; description: string; percentageOfFunds: number }[];
  reasoning: string;
};

router.post("/ai/co-founder", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const message = String(body.message ?? "").trim();
  const draft: CoFounderDraft = body.draft ?? {};
  const pitchId = typeof body.pitchId === "string" ? body.pitchId : null;

  if (!message) { res.status(400).json({ error: "message required" }); return; }

  let session = sessionId
    ? (await db.select().from(coFounderSessionsTable).where(eq(coFounderSessionsTable.id, sessionId)))[0]
    : undefined;

  if (session && session.founderId !== meId) { res.status(403).json({ error: "forbidden" }); return; }

  const priorMessages: { role: string; content: string }[] = Array.isArray(session?.messages)
    ? (session!.messages as { role: string; content: string }[])
    : [];

  const systemPrompt = `You are the HumanVerse AI Co-Founder, an expert startup advisor helping a founder refine their pitch before publishing to the Hub.
Given the founder's current draft and their message, respond conversationally AND produce an optimized structured state.
Rules:
- Break the project into 3-5 milestones whose percentageOfFunds sum to exactly 100.
- Recommend a realistic raising amount in Pi (π) given scope.
- Keep summary punchy (<= 3 sentences).
- Always return valid JSON at the end wrapped in a single JSON object with keys: reply, title, summary, raising, budgetNotes, milestones (array of {title, description, percentageOfFunds}), reasoning.
Current draft: ${JSON.stringify(draft)}`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  let reply = "";
  let optimized: CoFounderOptimized | null = null;

  if (!groq) {
    reply = "AI Co-Founder is in mock mode — add a GROQ_API_KEY secret to activate live reasoning.";
    optimized = {
      title: draft.title ?? "Untitled Project",
      summary: draft.summary ?? "",
      raising: draft.raising ?? 1000,
      budgetNotes: "Mock budget: 40% build, 30% growth, 30% ops reserve.",
      milestones: draft.milestones?.length
        ? draft.milestones
        : [
            { title: "Foundation", description: "Core setup and validation", percentageOfFunds: 30 },
            { title: "Build", description: "Ship core product", percentageOfFunds: 40 },
            { title: "Launch", description: "Go-to-market and first users", percentageOfFunds: 30 },
          ],
      reasoning: "Mock response — no live model configured.",
    };
  } else {
    try {
      const completion = await groq.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 2048,
        messages: chatMessages,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = extractJson<CoFounderOptimized & { reply: string }>(raw);
      if (parsed) {
        reply = parsed.reply ?? "Here's your refined plan.";
        optimized = {
          title: parsed.title ?? draft.title ?? "Untitled Project",
          summary: parsed.summary ?? draft.summary ?? "",
          raising: Number(parsed.raising ?? draft.raising ?? 0),
          budgetNotes: parsed.budgetNotes ?? "",
          milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
          reasoning: parsed.reasoning ?? "",
        };
      } else {
        reply = raw;
      }
    } catch {
      reply = "AI Co-Founder service is temporarily unavailable. Please try again.";
    }
  }

  const updatedMessages = [
    ...priorMessages,
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ];

  if (session) {
    await db.update(coFounderSessionsTable).set({
      messages: updatedMessages,
      draftState: draft,
      optimizedState: optimized,
      pitchId: pitchId ?? session.pitchId,
      updatedAt: new Date(),
    }).where(eq(coFounderSessionsTable.id, session.id));
  } else {
    const id = uid("cfs");
    await db.insert(coFounderSessionsTable).values({
      id,
      founderId: meId,
      pitchId,
      status: "draft",
      messages: updatedMessages,
      draftState: draft,
      optimizedState: optimized,
    });
    session = (await db.select().from(coFounderSessionsTable).where(eq(coFounderSessionsTable.id, id)))[0];
  }

  res.json({ sessionId: session!.id, reply, optimizedState: optimized });
});

router.get("/ai/co-founder/:sessionId", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const [session] = await db.select().from(coFounderSessionsTable).where(eq(coFounderSessionsTable.id, sessionId));
  if (!session || session.founderId !== meId) { res.status(404).json({ error: "session not found" }); return; }
  res.json({ ...session, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() });
});

router.post("/ai/co-founder/:sessionId/finalize", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const [session] = await db.select().from(coFounderSessionsTable).where(eq(coFounderSessionsTable.id, sessionId));
  if (!session || session.founderId !== meId) { res.status(404).json({ error: "session not found" }); return; }
  if (!session.optimizedState) { res.status(400).json({ error: "no optimized state to finalize" }); return; }

  await db.update(coFounderSessionsTable).set({ status: "finalized", updatedAt: new Date() }).where(eq(coFounderSessionsTable.id, sessionId));
  res.json({ sessionId, status: "finalized", optimizedState: session.optimizedState });
});

type AuditResult = { confidenceScore: number; summary: string; flags: string[] };

export async function runMilestoneAudit(params: {
  milestoneId: string;
  pitchId: string;
  title: string;
  description: string;
  proofUrl: string | null;
}): Promise<AuditResult> {
  const { milestoneId, pitchId, title, description, proofUrl } = params;

  let result: AuditResult;

  if (!groq) {
    result = {
      confidenceScore: proofUrl ? 55 : 20,
      summary: "Mock audit — add a GROQ_API_KEY secret to enable live AI escrow auditing.",
      flags: proofUrl ? [] : ["no_proof_link_provided"],
    };
  } else {
    const systemPrompt = `You are the HumanVerse Autonomous Escrow Auditor, a protocol-level AI agent that performs a preliminary technical audit of a founder's Milestone Proof of Work, to assist human Validators before funds release.
Assess plausibility, technical coherence, and whether the proof link/text substantiates the milestone claim. Be skeptical of vague or generic claims.
Return strict JSON: { "confidenceScore": number 0-100, "summary": string (2-4 sentences, technical audit tone), "flags": string[] (short risk tags, e.g. "no_link", "generic_description", "possible_plagiarism", "unverifiable_claim") }.`;

    const userPrompt = `Milestone: "${title}"
Description: ${description}
Proof URL / text submitted: ${proofUrl ?? "(none provided)"}`;

    try {
      const completion = await groq.chat.completions.create({
        model: FAST_MODEL,
        max_tokens: 512,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = extractJson<AuditResult>(raw);
      result = parsed
        ? {
            confidenceScore: Math.max(0, Math.min(100, Number(parsed.confidenceScore) || 0)),
            summary: parsed.summary ?? "Audit completed with no summary generated.",
            flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
          }
        : { confidenceScore: 40, summary: "Audit model returned an unparsable response.", flags: ["parse_error"] };
    } catch {
      result = { confidenceScore: 0, summary: "Audit service unavailable at submission time.", flags: ["audit_service_error"] };
    }
  }

  const id = uid("aud");
  await db.insert(milestoneAuditsTable).values({
    id,
    milestoneId,
    pitchId,
    proofUrl,
    proofText: description,
    confidenceScore: result.confidenceScore,
    summary: result.summary,
    flags: result.flags,
    model: groq ? FAST_MODEL : "mock",
  });

  return result;
}

router.post("/ai/audit", async (req, res): Promise<void> => {
  const body = req.body ?? {};
  const milestoneId = String(body.milestoneId ?? "").trim();
  if (!milestoneId) { res.status(400).json({ error: "milestoneId required" }); return; }

  const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestoneId));
  if (!milestone) { res.status(404).json({ error: "milestone not found" }); return; }

  const result = await runMilestoneAudit({
    milestoneId: milestone.id,
    pitchId: milestone.pitchId,
    title: milestone.title,
    description: milestone.description,
    proofUrl: milestone.proofUrl ?? (typeof body.proofUrl === "string" ? body.proofUrl : null),
  });

  res.json({ milestoneId, ...result });
});

router.get("/ai/audit/:milestoneId", async (req, res): Promise<void> => {
  const milestoneId = Array.isArray(req.params.milestoneId) ? req.params.milestoneId[0] : req.params.milestoneId;
  const [latest] = await db.select().from(milestoneAuditsTable)
    .where(eq(milestoneAuditsTable.milestoneId, milestoneId))
    .orderBy(desc(milestoneAuditsTable.createdAt))
    .limit(1);
  if (!latest) { res.status(404).json({ error: "no audit found" }); return; }
  res.json({ ...latest, createdAt: latest.createdAt.toISOString() });
});

router.get("/ai/matchmaker", async (req, res): Promise<void> => {
  const meId = currentUserId(req);

  const myInvestments = await db.select({
    pitchId: transactionsTable.pitchId,
    amount: transactionsTable.amount,
  }).from(transactionsTable)
    .where(and(eq(transactionsTable.userId, meId), eq(transactionsTable.type, "invest")));

  const myProposals = await db.select({
    pitchId: proposalsTable.pitchId,
    amountPi: proposalsTable.amountPi,
  }).from(proposalsTable).where(eq(proposalsTable.investorId, meId));

  const backedPitchIds = Array.from(new Set([...myInvestments.map((i) => i.pitchId), ...myProposals.map((p) => p.pitchId)]));

  let favoredIndustries = new Map<string, number>();
  let avgCheckSize = 0;

  if (backedPitchIds.length > 0) {
    const backedPitches = await db.select({
      id: pitchesTable.id,
      industry: pitchesTable.industry,
      stage: pitchesTable.stage,
    }).from(pitchesTable).where(inArray(pitchesTable.id, backedPitchIds));

    for (const p of backedPitches) {
      favoredIndustries.set(p.industry, (favoredIndustries.get(p.industry) ?? 0) + 1);
    }

    const totalAmount = [...myInvestments.map((i) => i.amount), ...myProposals.map((p) => p.amountPi)]
      .reduce((sum, n) => sum + n, 0);
    const totalCount = myInvestments.length + myProposals.length;
    avgCheckSize = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;
  }

  const candidates = await db.select({
    id: pitchesTable.id,
    title: pitchesTable.title,
    industry: pitchesTable.industry,
    stage: pitchesTable.stage,
    city: pitchesTable.city,
    raising: pitchesTable.raising,
    raised: pitchesTable.raised,
    backersCount: pitchesTable.backersCount,
    trending: pitchesTable.trending,
    trustScore: pitchesTable.trustScore,
    verificationStatus: pitchesTable.verificationStatus,
    summary: pitchesTable.summary,
    founderId: pitchesTable.founderId,
  }).from(pitchesTable)
    .where(sql`${pitchesTable.founderId} != ${meId}`)
    .orderBy(desc(pitchesTable.trending), desc(pitchesTable.trustScore))
    .limit(60);

  const scored = candidates
    .filter((p) => !backedPitchIds.includes(p.id))
    .map((p) => {
      let score = 0;
      const industryAffinity = favoredIndustries.get(p.industry) ?? 0;
      score += industryAffinity * 30;
      if (p.trending) score += 20;
      if (p.verificationStatus !== "verified") score += 12;
      score += Math.min(20, (p.trustScore ?? 0) / 5);
      const fundingGap = p.raising > 0 ? 1 - p.raised / p.raising : 0;
      score += fundingGap * 15;
      if (avgCheckSize > 0) {
        const sizeFit = 1 - Math.min(1, Math.abs(p.raising - avgCheckSize * 10) / (avgCheckSize * 10 || 1));
        score += sizeFit * 10;
      }
      return {
        id: p.id,
        title: p.title,
        industry: p.industry,
        stage: p.stage,
        city: p.city,
        raising: p.raising,
        raised: p.raised,
        backersCount: p.backersCount,
        trending: p.trending,
        trustScore: p.trustScore,
        verificationStatus: p.verificationStatus,
        summary: p.summary,
        matchScore: Math.round(score),
        matchReason: industryAffinity > 0
          ? `Matches your ${p.industry} investment history`
          : p.trending
            ? "Trending in the Hub right now"
            : "High-potential unverified project worth early exposure",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);

  res.json({
    profile: {
      backedProjectsCount: backedPitchIds.length,
      favoredIndustries: Array.from(favoredIndustries.entries()).map(([industry, count]) => ({ industry, count })),
      avgCheckSize,
    },
    recommendations: scored,
  });
});

export default router;
