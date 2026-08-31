import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, appDirectoryTable } from "@workspace/db";
import { currentUserId } from "../lib/currentUser";
import { getPagination } from "../lib/requestSecurity";

const router: IRouter = Router();

const APPROVED_HOSTS = new Set([
  "pinetwork.com",
  "minepi.com",
  "sandbox.minepi.com",
  "socialchain.app",
  "fireside.chat",
  "pi-apps.io",
  "pitechnoloapp.com",
  "mapping.pi",
  "oasisapp.pi",
]);

function isVerifiedLink(url: string): boolean {
  try {
    if (url.startsWith("pinetwork://")) return true;
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    return APPROVED_HOSTS.has(host);
  } catch {
    return false;
  }
}

function uid() {
  return `app_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const MOCK_APPS = [
  { id: "mock_app_1", name: "Pi Exchange", tagline: "Trade Pi seamlessly with peers", description: "A decentralized peer-to-peer exchange built natively on the Pi Network. Swap Pi for goods, services, and other digital assets with zero fees.", platform: "Both", category: "DeFi", verifiedLink: "pinetwork://exchange", logoUrl: null, securityScore: 98, submissionStatus: "approved", submittedBy: "system", createdAt: new Date().toISOString() },
  { id: "mock_app_2", name: "PiMart", tagline: "Shop with Pi — the Pi-native marketplace", description: "Browse thousands of verified products and services. Pay exclusively with Pi. Sellers are KYC-verified through the Pi Network.", platform: "Mobile", category: "Commerce", verifiedLink: "pinetwork://pimart", logoUrl: null, securityScore: 95, submissionStatus: "approved", submittedBy: "system", createdAt: new Date().toISOString() },
  { id: "mock_app_3", name: "OasisLearn", tagline: "Education powered by Pi", description: "Access thousands of courses, workshops, and live coaching sessions. Instructors earn Pi directly from students. Knowledge democratized.", platform: "Both", category: "Education", verifiedLink: "pinetwork://oasislearn", logoUrl: null, securityScore: 92, submissionStatus: "approved", submittedBy: "system", createdAt: new Date().toISOString() },
  { id: "mock_app_4", name: "Pi Health", tagline: "Book doctors, pay in Pi", description: "Connect with licensed healthcare professionals worldwide. Schedule consultations, access digital prescriptions, and pay entirely in Pi.", platform: "Mobile", category: "Health", verifiedLink: "https://pi-apps.io", logoUrl: null, securityScore: 90, submissionStatus: "approved", submittedBy: "system", createdAt: new Date().toISOString() },
  { id: "mock_app_5", name: "PiMap Pro", tagline: "Navigate and earn Pi", description: "Community-powered mapping that rewards contributors with Pi for adding verified locations, reporting road conditions, and helping others navigate.", platform: "Mobile", category: "Navigation", verifiedLink: "https://mapping.pi", logoUrl: null, securityScore: 88, submissionStatus: "approved", submittedBy: "system", createdAt: new Date().toISOString() },
];

router.get("/apps", async (_req, res): Promise<void> => {
  const { limit, offset } = getPagination(res);
  const apps = await db.select().from(appDirectoryTable)
    .where(eq(appDirectoryTable.submissionStatus, "approved"))
    .orderBy(desc(appDirectoryTable.securityScore), desc(appDirectoryTable.createdAt))
    .limit(limit).offset(offset);
  res.json(apps.length > 0 ? apps : MOCK_APPS.slice(offset, offset + limit));
});

router.post("/apps", async (req, res): Promise<void> => {
  const meId = currentUserId(req);
  const body = req.body ?? {};
  const name = String(body.name ?? "").trim();
  const tagline = String(body.tagline ?? "").trim();
  const description = String(body.description ?? "").trim();
  const platform = ["Mobile", "PC", "Both"].includes(body.platform) ? (body.platform as string) : "Both";
  const category = String(body.category ?? "DeFi").trim();
  const verifiedLink = String(body.verifiedLink ?? "").trim();
  const logoUrl = typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null;

  if (!name || !tagline || !verifiedLink) {
    res.status(400).json({ error: "name, tagline, verifiedLink required" }); return;
  }
  if (!isVerifiedLink(verifiedLink)) {
    res.status(422).json({
      error: "verifiedLink must be a verified Pi Network domain (pinetwork.com, minepi.com) or use the pinetwork:// scheme. Arbitrary external URLs are not permitted.",
    }); return;
  }

  const id = uid();
  await db.insert(appDirectoryTable).values({
    id, name, tagline, description, platform, category, verifiedLink,
    logoUrl, securityScore: 50, submissionStatus: "pending", submittedBy: meId,
  });

  const [created] = await db.select().from(appDirectoryTable).where(eq(appDirectoryTable.id, id));
  res.status(201).json({ ...created, message: "App submitted for review. It will appear once approved." });
});

router.get("/apps/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [app] = await db.select().from(appDirectoryTable).where(eq(appDirectoryTable.id, id));
  if (!app) { res.status(404).json({ error: "Not found" }); return; }
  if (!isVerifiedLink(app.verifiedLink)) {
    res.status(451).json({ error: "This app's link failed security verification and cannot be accessed." }); return;
  }
  res.json(app);
});

export default router;
