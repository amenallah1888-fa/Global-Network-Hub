import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Pitch, User } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

const VALIDATOR_BLOCKS = [
  { key: "identity", label: "Professional Verification", description: "Verified LinkedIn profile or professional network presence confirming the founder's real-world professional standing. (Legal identity documents are managed separately via account-level KYC.)", icon: "user-check", points: 25 },
  { key: "reality", label: "Proof of Reality", description: "Video demo, live product, or working prototype proving the project is real and functional.", icon: "play-circle", points: 25 },
  { key: "roadmap", label: "Roadmap / Vision", description: "Published roadmap, timeline, or development plan showing a credible path to completion.", icon: "map", points: 25 },
  { key: "portfolio", label: "Portfolio / Experience", description: "Past work, references, or team credentials demonstrating the ability to deliver.", icon: "briefcase", points: 25 },
] as const;

type PitchUpdate = { id: string; pitchId: string; authorId: string; content: string; createdAt: string };
type Supporter = { id: string; name: string; avatarKey: string | null; handle: string };
type Milestone = { id: string; pitchId: string; proposalId: string; title: string; description: string; percentageOfFunds: number; status: string; proofUrl: string | null; completedAt: string | null; order: number };
type ProjectDocument = { id: string; projectId: string; documentUrl: string; documentType: string; status: string; reviewNote: string | null; uploadedAt: string };
type PitchDetail = Pitch & { founder: (User & { following?: boolean }) | null; related: (Pitch & { verified?: boolean })[]; supporters?: Supporter[]; verified?: boolean; trustScore?: number; entityType?: string; serviceCategory?: string; verificationStatus?: string; roadmapUrl?: string | null; founderLinkedin?: string | null; proofOfRealityUrl?: string | null; portfolioUrl?: string | null; experienceDescription?: string | null };
type ActiveTab = "overview" | "milestones" | "verification" | "capsules";
type Capsule = { id: string; pitchId: string; founderId: string; title: string; body: string; videoUrl: string | null; codeLogUrl: string | null; weekNumber: number; createdAt: string };
type EscrowStep = "idle" | "initiating" | "locking" | "active";

function formatPi(n: number) { return `${n.toLocaleString()} π`; }
function pct(raised: number, raising: number) { if (!raising) return 0; return Math.min(100, Math.round((raised / raising) * 100)); }
function timeAgo(dateStr: string) { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return `${Math.floor(hrs / 24)}d ago`; }
function shortHash(h: string) { return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "—"; }

const STAGE_COLOR: Record<string, string> = { "Pre-seed": "#F97316", Seed: "#EAB308", "Series A": "#22C55E", "Series B": "#3B82F6", "Series C": "#8B5CF6" };
const MOCK_CAPSULES: Capsule[] = [
  { id: "mock-1", pitchId: "demo", founderId: "demo", title: "Week 1 — Foundation shipped 🚀", body: "Bootstrapped the repo, configured CI/CD pipeline, and integrated the Pi SDK for payment processing. Architecture decisions documented. Team velocity looking strong — ahead of schedule by 2 days.", videoUrl: null, codeLogUrl: null, weekNumber: 1, createdAt: new Date(Date.now() - 14 * 86400000).toISOString() },
  { id: "mock-2", pitchId: "demo", founderId: "demo", title: "Week 2 — Auth & Escrow MVP live", body: "User authentication complete. Pi escrow wallet integration tested on testnet — 3 successful transactions. UI polished to match design specs. Next milestone: public beta onboarding.", videoUrl: null, codeLogUrl: null, weekNumber: 2, createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
];
const MILESTONE_STATUS_COLOR: Record<string, string> = { locked: "#6B7280", pending_proof: "#F59E0B", released: "#22C55E" };
const MILESTONE_STATUS_LABEL: Record<string, string> = { locked: "Locked", pending_proof: "Proof Submitted", released: "Released" };

export default function PitchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [escrowStep, setEscrowStep] = useState<EscrowStep>("idle");
  const [escrowAmount, setEscrowAmount] = useState("10");
  const [escrowResult, setEscrowResult] = useState<{ id: string; termsHash: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [proofInputs, setProofInputs] = useState<Record<string, string>>({});
  const [submittingProof, setSubmittingProof] = useState<string | null>(null);
  const [newDocUrl, setNewDocUrl] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [validatingBlock, setValidatingBlock] = useState<string | null>(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState("5");
  const [donating, setDonating] = useState(false);
  const [donateSuccess, setDonateSuccess] = useState(false);
  const [isExpressedInterest, setIsExpressedInterest] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const [capsuleTitle, setCapsuleTitle] = useState("");
  const [capsuleBody, setCapsuleBody] = useState("");
  const [capsuleVideoUrl, setCapsuleVideoUrl] = useState("");
  const [postingCapsule, setPostingCapsule] = useState(false);
  const [expandedCapsule, setExpandedCapsule] = useState<string | null>(null);
  const [tipCapsuleId, setTipCapsuleId] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState("1");
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("success");
  const [proofSubmitBlock, setProofSubmitBlock] = useState<{ field: string; label: string; sublabel: string; placeholder: string; description: string } | null>(null);
  const [proofSubmitUrl, setProofSubmitUrl] = useState("");
  const [savingProofUrl, setSavingProofUrl] = useState(false);

  const { data: pitch, isLoading, isError } = useQuery<PitchDetail>({
    queryKey: [`/api/pitches/${id}`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${id}`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) throw new Error("Not found"); return res.json(); },
    enabled: !!id && !!token,
    staleTime: 15_000,
    retry: 1,
  });

  const { data: updates } = useQuery<PitchUpdate[]>({
    queryKey: [`/api/pitches/${id}/updates`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${id}/updates`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) return []; return res.json(); },
    enabled: !!id && !!token,
    staleTime: 30_000,
  });

  const { data: milestones, refetch: refetchMilestones } = useQuery<Milestone[]>({
    queryKey: [`/api/pitches/${id}/milestones`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${id}/milestones`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) return []; return res.json(); },
    enabled: !!id && !!token,
    staleTime: 20_000,
  });

  const { data: documents, refetch: refetchDocs } = useQuery<ProjectDocument[]>({
    queryKey: [`/api/pitches/${id}/documents`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${id}/documents`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) return []; return res.json(); },
    enabled: !!id && !!token,
    staleTime: 20_000,
  });

  const { data: capsulesData, refetch: refetchCapsules } = useQuery<{ pitchTitle: string; founder: any; totalCapsules: number; capsules: Capsule[] }>({
    queryKey: [`/api/pitches/${id}/capsules`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${id}/capsules`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) return { pitchTitle: "", founder: null, totalCapsules: 0, capsules: [] }; return res.json(); },
    enabled: !!id && !!token && activeTab === "capsules",
    staleTime: 15_000,
  });

  const isFounder = pitch?.founderId === user?.id;
  const isServiceApp = pitch?.entityType === "service_app";
  const stageColor = pitch ? isServiceApp ? "#F97316" : (STAGE_COLOR[pitch.stage] ?? colors.primary) : colors.primary;
  const progress = pitch ? pct(pitch.raised, pitch.raising) : 0;
  const isVerified = pitch?.verified ?? false;
  const actionLabel = isServiceApp ? "Request Service" : "Invest in Escrow";
  const actionedLabel = isServiceApp ? "Service Requested" : "Interest Expressed";

  const handleInvest = () => {
    setEscrowStep("idle");
    setEscrowAmount("10");
    setEscrowResult(null);
    setShowEscrowModal(true);
  };

  const confirmEscrow = async () => {
    const amount = parseInt(escrowAmount, 10);
    if (!amount || amount <= 0) { Alert.alert("Invalid amount", "Enter a valid Pi amount (minimum 1 π)"); return; }
    setEscrowStep("initiating");
    await new Promise(r => setTimeout(r, 1200));
    setEscrowStep("locking");
    try {
      const defaultMilestones = [
        { title: "Phase 1 — Foundation", description: "Initial setup and groundwork", percentage: 30 },
        { title: "Phase 2 — Build", description: "Core feature development", percentage: 40 },
        { title: "Phase 3 — Launch", description: "Testing, polish, and launch", percentage: 30 },
      ];
      const res = await fetch(`${API_BASE}/api/smart-agreements`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, totalPiCommitted: amount, milestones: defaultMilestones }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Agreement failed"); }
      const data = await res.json();
      setEscrowResult({ id: data.id, termsHash: data.termsHash });
      await fetch(`${API_BASE}/api/pitches/${id}/back`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/pitches"] });
      refetchMilestones();
      setEscrowStep("active");
      setToastMsg("π locked in Escrow. Awaiting the founder's milestone delivery.");
      setToastType("success");
      setToastVisible(true);
    } catch (err: any) {
      setEscrowStep("idle");
      Alert.alert("Error", err.message ?? "Failed to create agreement");
    }
  };

  const handleReport = async () => {
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/report`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ reason: reportReason }) });
      setReportSent(true);
    } catch {}
  };

  const handlePostUpdate = async () => {
    if (!newUpdate.trim()) return;
    setPostingUpdate(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/updates`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ content: newUpdate }) });
      setNewUpdate("");
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}/updates`] });
    } finally { setPostingUpdate(false); }
  };

  const handlePostCapsule = async () => {
    if (!capsuleTitle.trim() || !capsuleBody.trim()) return;
    setPostingCapsule(true);
    try {
      const res = await fetch(`${API_BASE}/api/pitches/${id}/capsules`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: capsuleTitle, body: capsuleBody, videoUrl: capsuleVideoUrl.trim() || null }),
      });
      if (res.ok) {
        setCapsuleTitle("");
        setCapsuleBody("");
        setCapsuleVideoUrl("");
        refetchCapsules();
      } else {
        const d = await res.json();
        Alert.alert("Error", d.error ?? "Could not post capsule");
      }
    } finally { setPostingCapsule(false); }
  };

  const handleTipCapsule = async () => {
    const amt = parseInt(tipAmount, 10);
    if (!amt || amt <= 0 || !tipCapsuleId) return;
    setTipping(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/back`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      setTipSuccess(true);
    } catch { Alert.alert("Error", "Could not send tip"); } finally { setTipping(false); }
  };

  const handleSubmitProof = async (milestoneId: string) => {
    const url = proofInputs[milestoneId]?.trim();
    if (!url) { Alert.alert("Required", "Enter a proof URL or link"); return; }
    setSubmittingProof(milestoneId);
    try {
      const res = await fetch(`${API_BASE}/api/milestones/${milestoneId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "pending_proof", proofUrl: url }) });
      if (!res.ok) throw new Error("Failed");
      setProofInputs(prev => ({ ...prev, [milestoneId]: "" }));
      refetchMilestones();
    } catch { Alert.alert("Error", "Could not submit proof"); } finally { setSubmittingProof(null); }
  };

  const handleVerifyMilestone = async (milestoneId: string) => {
    Alert.alert("Verify Milestone", "This will release the funds for this milestone phase.", [
      { text: "Cancel", style: "cancel" },
      { text: "Verify & Release", onPress: async () => {
        try {
          await fetch(`${API_BASE}/api/milestones/${milestoneId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "released" }) });
          refetchMilestones();
        } catch { Alert.alert("Error", "Could not verify milestone"); }
      }},
    ]);
  };

  const handleValidateBlock = async (block: string, action: "approve" | "reject") => {
    setValidatingBlock(block + "_" + action);
    try {
      const res = await fetch(`${API_BASE}/api/pitches/${id}/validate-block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ block, action }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      const data = await res.json();
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/pitches"] });
      if (data.migrated) Alert.alert("Auto-Migrated!", `"${pitch?.title}" reached 100% trust and has been published to the Ecosystem!`);
    } catch (err: any) { Alert.alert("Error", err.message ?? "Validation failed"); } finally { setValidatingBlock(null); }
  };

  const handleDonate = async () => {
    const amt = parseInt(donateAmount, 10);
    if (!amt || amt <= 0) { Alert.alert("Invalid", "Enter a valid π amount"); return; }
    setDonating(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/back`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}`] });
      setDonateSuccess(true);
    } catch { Alert.alert("Error", "Donation failed. Please try again."); } finally { setDonating(false); }
  };

  const handleSendOffer = async () => {
    const amt = parseInt(offerAmount, 10);
    if (!offerNote.trim()) { Alert.alert("Required", "Add a message with your offer"); return; }
    setSendingOffer(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/back`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt > 0 ? amt : 0 }),
      });
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}`] });
      setOfferSent(true);
    } catch { Alert.alert("Error", "Could not send offer. Please try again."); } finally { setSendingOffer(false); }
  };

  const handleSaveProofUrl = async () => {
    if (!proofSubmitBlock) return;
    const url = proofSubmitUrl.trim();
    if (!url) { Alert.alert("Required", "Paste a public URL for this proof block"); return; }
    setSavingProofUrl(true);
    try {
      const res = await fetch(`${API_BASE}/api/pitches/${id}/proof-links`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [proofSubmitBlock.field]: url }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/pitches"] });
      setProofSubmitBlock(null);
      setProofSubmitUrl("");
      setToastMsg("Proof submitted! A Validator will now review this block.");
      setToastType("success");
      setToastVisible(true);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not save proof link");
    } finally {
      setSavingProofUrl(false);
    }
  };

  const handleAddDocument = async () => {
    if (!newDocUrl.trim()) return;
    setAddingDoc(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ documentUrl: newDocUrl.trim(), documentType: "proof" }) });
      setNewDocUrl("");
      refetchDocs();
    } catch { Alert.alert("Error", "Could not add document"); } finally { setAddingDoc(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>
          {isLoading ? "Loading…" : (isServiceApp ? "Service Details" : "Project Details")}
        </Text>
        <Pressable onPress={() => setShowReportModal(true)} hitSlop={10} style={({ pressed }) => [styles.reportBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="flag" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {isError ? (
        <View style={[styles.center, { gap: 12 }]}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={[styles.topBarTitle, { color: colors.mutedForeground }]}>Project not found</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.primary, paddingHorizontal: 20, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Go back</Text>
          </Pressable>
        </View>
      ) : isLoading || !pitch ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.hero, { backgroundColor: stageColor + "18", borderBottomColor: colors.border }]}>
              <View style={[styles.heroIcon, { backgroundColor: stageColor + "22" }]}>
                <Feather name={isServiceApp ? "tool" : "zap"} size={32} color={stageColor} />
              </View>
              <View style={styles.badges}>
                {!isServiceApp && <Badge label={pitch.stage} color={stageColor} />}
                <Badge label={isServiceApp ? (pitch.serviceCategory ?? "Service") : pitch.industry} color={colors.accent} />
                <Badge label={pitch.city} color={colors.mutedForeground} icon="map-pin" />
                {isVerified ? <Badge label="Verified" color="#22C55E" icon="check-circle" /> : <Badge label="Unverified" color={colors.mutedForeground} icon="alert-circle" />}
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>{pitch.title}</Text>
            </View>

            <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              {(["overview", "milestones", "verification", "capsules"] as ActiveTab[]).map((tab) => (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabBtn, { borderBottomColor: activeTab === tab ? colors.primary : "transparent" }]}>
                  <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                    {tab === "overview" ? "Overview" : tab === "milestones" ? "Milestones" : tab === "verification" ? "Verify" : "Capsules"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.body}>
              {activeTab === "overview" && (
                <>
                  <Text style={[styles.summary, { color: colors.mutedForeground }]}>{pitch.summary}</Text>

                  {!isServiceApp && (
                    <View style={[styles.fundingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.fundingRow}>
                        <View>
                          <Text style={[styles.fundingAmount, { color: colors.foreground }]}>{formatPi(pitch.raised)}</Text>
                          <Text style={[styles.fundingLabel, { color: colors.mutedForeground }]}>raised of {formatPi(pitch.raising)}</Text>
                        </View>
                        <Text style={[styles.pctText, { color: stageColor }]}>{progress}%</Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: stageColor }]} />
                      </View>
                      <View style={styles.statsRow}>
                        <MiniStat label="Backers" value={pitch.backersCount.toString()} colors={colors} />
                        <MiniStat label="Stage" value={pitch.stage} colors={colors} />
                        <MiniStat label="Industry" value={pitch.industry} colors={colors} />
                      </View>
                      {(pitch as any).founderCollateral > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "#F59E0B12", borderWidth: 1, borderColor: "#F59E0B40" }}>
                          <Feather name="lock" size={13} color="#F59E0B" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>Collateral Secured</Text>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                              {((pitch as any).founderCollateral ?? 0).toLocaleString()} π locked in escrow by founder (10% of raise target)
                            </Text>
                          </View>
                          <View style={{ backgroundColor: "#F59E0B18", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>10%</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {isServiceApp && pitch.experienceDescription ? (
                    <View style={[styles.fundingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 0 }]}>Experience</Text>
                      <Text style={[styles.summary, { color: colors.mutedForeground, marginBottom: 0 }]}>{pitch.experienceDescription}</Text>
                    </View>
                  ) : null}

                  <View style={styles.proofRow}>
                    {pitch.proofOfRealityUrl ? <Pressable onPress={() => Linking.openURL(pitch.proofOfRealityUrl!)} style={({ pressed }) => [styles.proofBtn, { backgroundColor: "#22C55E18", borderColor: "#22C55E", opacity: pressed ? 0.8 : 1 }]}><Feather name="play-circle" size={14} color="#22C55E" /><Text style={[styles.proofBtnText, { color: "#22C55E" }]}>View Proof</Text></Pressable> : null}
                    {pitch.roadmapUrl ? <Pressable onPress={() => Linking.openURL(pitch.roadmapUrl!)} style={({ pressed }) => [styles.proofBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}><Feather name="map" size={14} color={colors.primary} /><Text style={[styles.proofBtnText, { color: colors.primary }]}>Roadmap</Text></Pressable> : null}
                    {pitch.portfolioUrl ? <Pressable onPress={() => Linking.openURL(pitch.portfolioUrl!)} style={({ pressed }) => [styles.proofBtn, { backgroundColor: colors.accent + "18", borderColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}><Feather name="briefcase" size={14} color={colors.accent} /><Text style={[styles.proofBtnText, { color: colors.accent }]}>Portfolio</Text></Pressable> : null}
                  </View>

                  {!pitch.backed && !isExpressedInterest ? (
                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={handleInvest}
                        style={({ pressed }) => [styles.actionBtn, {
                          backgroundColor: stageColor,
                          flex: 1.2,
                          opacity: pressed ? 0.85 : 1,
                        }]}
                      >
                        <Feather name={isServiceApp ? "tool" : "trending-up"} size={14} color="#fff" />
                        <Text style={[styles.actionBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                          {isServiceApp ? "Hire" : "Invest"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { setDonateSuccess(false); setDonateAmount("5"); setShowDonateModal(true); }}
                        style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#EF444418", borderColor: "#EF4444", borderWidth: 1, flex: 1, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>❤️ Donate</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={[styles.investBtn, { backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border }]}>
                      <Feather name="check-circle" size={16} color="#22C55E" />
                      <Text style={[styles.investBtnText, { color: colors.foreground }]}>{actionedLabel}</Text>
                    </View>
                  )}

                  {pitch.founder && (
                    <>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Founder</Text>
                      <Pressable onPress={() => router.push(`/profile/${pitch.founder!.id}`)} style={({ pressed }) => [styles.founderCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
                        <Avatar avatarKey={pitch.founder.avatarKey} size={52} ring />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <View style={styles.founderNameRow}>
                            <Text style={[styles.founderName, { color: colors.foreground }]}>{pitch.founder.name}</Text>
                            {(pitch.founder as any).verified && <Feather name="check-circle" size={13} color={colors.primary} />}
                          </View>
                          <Text style={[styles.founderRole, { color: colors.mutedForeground }]}>{(pitch.founder as any).title} · {(pitch.founder as any).company}</Text>
                          <Text style={[styles.founderCity, { color: colors.mutedForeground }]}>{(pitch.founder as any).city}</Text>
                        </View>
                        {pitch.founderLinkedin ? <Pressable onPress={() => Linking.openURL(pitch.founderLinkedin!)} hitSlop={8}><Feather name="linkedin" size={16} color={colors.primary} /></Pressable> : null}
                        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    </>
                  )}

                  {pitch.supporters && pitch.supporters.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Backers ({pitch.supporters.length})</Text>
                      <View style={[styles.supportersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {pitch.supporters.map((s) => (
                          <View key={s.id} style={styles.supporterRow}>
                            <Avatar avatarKey={s.avatarKey} size={32} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.supporterName, { color: colors.foreground }]}>{s.name}</Text>
                              <Text style={[styles.supporterHandle, { color: colors.mutedForeground }]}>@{s.handle}</Text>
                            </View>
                            <Feather name="heart" size={13} color="#EF4444" />
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Updates</Text>
                  <View style={[styles.updatesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {isFounder && (
                      <View style={[styles.updateComposer, { borderBottomColor: colors.border }]}>
                        <TextInput value={newUpdate} onChangeText={setNewUpdate} placeholder="Post an update…" placeholderTextColor={colors.mutedForeground} style={[styles.updateInput, { color: colors.foreground, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} multiline />
                        <Pressable onPress={handlePostUpdate} disabled={postingUpdate || !newUpdate.trim()} style={({ pressed }) => [styles.updatePostBtn, { backgroundColor: colors.primary, opacity: pressed || !newUpdate.trim() ? 0.5 : 1 }]}>
                          {postingUpdate ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={13} color="#fff" />}
                        </Pressable>
                      </View>
                    )}
                    {!updates || updates.length === 0 ? (
                      <View style={styles.emptyBox}><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No updates yet</Text></View>
                    ) : (
                      updates.map((u) => (
                        <View key={u.id} style={[styles.updateItem, { borderBottomColor: colors.border }]}>
                          <View style={styles.updateItemHeader}><Feather name="bell" size={12} color={colors.primary} /><Text style={[styles.updateItemTime, { color: colors.mutedForeground }]}>{timeAgo(u.createdAt)}</Text></View>
                          <Text style={[styles.updateItemContent, { color: colors.foreground }]}>{u.content}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  {pitch.related && pitch.related.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Similar in {pitch.industry}</Text>
                      {pitch.related.map((r) => (
                        <Pressable key={r.id} onPress={() => router.push(`/pitch/${r.id}`)} style={({ pressed }) => [styles.relatedCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
                          <View style={[styles.relatedIcon, { backgroundColor: (STAGE_COLOR[r.stage] ?? colors.primary) + "20" }]}><Feather name="zap" size={14} color={STAGE_COLOR[r.stage] ?? colors.primary} /></View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <Text style={[styles.relatedTitle, { color: colors.foreground }]}>{r.title}</Text>
                              {r.verified && <Feather name="check-circle" size={11} color="#22C55E" />}
                            </View>
                            <Text style={[styles.relatedMeta, { color: colors.mutedForeground }]}>{r.stage} · {formatPi(r.raised)} raised</Text>
                          </View>
                          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                        </Pressable>
                      ))}
                    </>
                  )}
                </>
              )}

              {activeTab === "milestones" && (
                <>
                  <View style={[styles.infoCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
                    <Feather name="info" size={13} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.primary }]}>
                      Funds release phase-by-phase (30% → 40% → 30%) and are verified exclusively by committed Backers — users who locked π via Smart Escrow.
                    </Text>
                  </View>

                  {!milestones || milestones.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Feather name="layers" size={28} color={colors.mutedForeground} />
                      <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 10 }]}>No milestones yet.{"\n"}They will appear after a backer creates an escrow agreement.</Text>
                    </View>
                  ) : (
                    milestones.map((m, i) => {
                      const mColor = MILESTONE_STATUS_COLOR[m.status] ?? "#6B7280";
                      const mLabel = MILESTONE_STATUS_LABEL[m.status] ?? m.status;
                      return (
                        <View key={m.id} style={[styles.milestoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={styles.milestoneHeader}>
                            <View style={[styles.milestoneNum, { backgroundColor: mColor + "22", borderColor: mColor }]}>
                              <Text style={[styles.milestoneNumText, { color: mColor }]}>{i + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.milestoneTitle, { color: colors.foreground }]}>{m.title}</Text>
                              <Text style={[styles.milestoneMeta, { color: colors.mutedForeground }]}>{m.percentageOfFunds}% of funds</Text>
                            </View>
                            <View style={[styles.statusChip, { backgroundColor: mColor + "18", borderColor: mColor }]}>
                              <Text style={[styles.statusChipText, { color: mColor }]}>{mLabel}</Text>
                            </View>
                          </View>
                          {!!m.description && <Text style={[styles.milestoneDesc, { color: colors.mutedForeground }]}>{m.description}</Text>}

                          {m.proofUrl ? (
                            <Pressable onPress={() => Linking.openURL(m.proofUrl!)} style={({ pressed }) => [styles.proofBtn, { backgroundColor: "#22C55E18", borderColor: "#22C55E", opacity: pressed ? 0.8 : 1, marginTop: 10 }]}>
                              <Feather name="external-link" size={13} color="#22C55E" />
                              <Text style={[styles.proofBtnText, { color: "#22C55E" }]}>View Proof of Work</Text>
                            </Pressable>
                          ) : null}

                          {isFounder && m.status === "locked" && (
                            <View style={{ marginTop: 12, gap: 8 }}>
                              <TextInput
                                value={proofInputs[m.id] ?? ""}
                                onChangeText={(v) => setProofInputs(prev => ({ ...prev, [m.id]: v }))}
                                placeholder="Paste proof URL (GitHub, video, doc…)"
                                placeholderTextColor={colors.mutedForeground}
                                style={[styles.proofInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                              />
                              <Pressable onPress={() => handleSubmitProof(m.id)} disabled={submittingProof === m.id} style={({ pressed }) => [styles.submitProofBtn, { backgroundColor: "#F59E0B", opacity: pressed || submittingProof === m.id ? 0.7 : 1 }]}>
                                {submittingProof === m.id ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="upload" size={14} color="#fff" /><Text style={styles.submitProofBtnText}>Submit Milestone Proof</Text></>}
                              </Pressable>
                            </View>
                          )}

                          {!isFounder && (pitch.backed || isExpressedInterest) && m.status === "pending_proof" && (
                            <Pressable onPress={() => handleVerifyMilestone(m.id)} style={({ pressed }) => [styles.verifyBtn, { backgroundColor: "#22C55E", opacity: pressed ? 0.8 : 1 }]}>
                              <Feather name="check" size={14} color="#fff" />
                              <Text style={styles.verifyBtnText}>Verify Milestone & Release Funds</Text>
                            </Pressable>
                          )}
                          {!isFounder && !(pitch.backed || isExpressedInterest) && m.status === "pending_proof" && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#6B728012", borderRadius: 8, padding: 8 }}>
                              <Feather name="lock" size={12} color="#6B7280" />
                              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", flex: 1 }}>Only Backers (escrow investors) can verify this milestone.</Text>
                            </View>
                          )}

                          {m.completedAt && (
                            <Text style={[styles.completedText, { color: "#22C55E" }]}>✓ Completed {timeAgo(m.completedAt)}</Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </>
              )}

              {activeTab === "verification" && (
                <>
                  {/* Proof of Intent */}
                  {(() => {
                    const PROOF_FIELDS = [
                      {
                        field: "founderLinkedin", label: "Identity", icon: "user-check" as const,
                        sublabel: "Professional Profile URL",
                        placeholder: "https://linkedin.com/in/yourprofile",
                        description: "Paste your verifiable professional network profile (LinkedIn) to verify your real-world identity.",
                        value: pitch.founderLinkedin, linkText: "View LinkedIn →",
                      },
                      {
                        field: "proofOfRealityUrl", label: "Reality Proof", icon: "play-circle" as const,
                        sublabel: "Video Demo or Working MVP URL",
                        placeholder: "https://youtube.com/watch?v=... or https://github.com/... or live link",
                        description: "Provide a public link to a video demo, live product prototype, or functional repository proving the product actually exists.",
                        value: pitch.proofOfRealityUrl, linkText: "View Demo →",
                      },
                      {
                        field: "roadmapUrl", label: "Roadmap", icon: "map" as const,
                        sublabel: "Interactive Roadmap or Project Documentation URL",
                        placeholder: "https://notion.so/... or https://trello.com/... or deck link",
                        description: "Submit a link to your public timeline, whitepaper, or product requirements document detailing the long-term milestones.",
                        value: pitch.roadmapUrl, linkText: "View Plan →",
                      },
                      {
                        field: "portfolioUrl", label: "Portfolio", icon: "briefcase" as const,
                        sublabel: "Past Work or Team Credentials URL",
                        placeholder: "https://behance.net/... or https://github.com/your-org or portfolio link",
                        description: "Provide references, case studies, or a portfolio linking to high-quality past work that proves your execution capabilities.",
                        value: pitch.portfolioUrl, linkText: "View Work →",
                      },
                    ];
                    return (
                      <View style={[styles.proofIntentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.proofIntentHeader}>
                          <Feather name="shield" size={16} color={colors.primary} />
                          <Text style={[styles.proofIntentTitle, { color: colors.foreground }]}>Proof of Intent</Text>
                          <Text style={[styles.proofIntentSub, { color: colors.mutedForeground }]}>Founder-submitted evidence</Text>
                        </View>
                        {isFounder && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.primary + "12", borderRadius: 8, padding: 8 }}>
                            <Feather name="edit-2" size={11} color={colors.primary} />
                            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.primary }}>Tap any unsubmitted block to add your proof link.</Text>
                          </View>
                        )}
                        <View style={styles.proofIntentGrid}>
                          {PROOF_FIELDS.map((pf) => {
                            const hasValue = !!pf.value;
                            const canSubmit = isFounder && !hasValue;
                            const Item = canSubmit ? Pressable : View;
                            return (
                              <Item
                                key={pf.field}
                                onPress={canSubmit ? () => { setProofSubmitBlock({ field: pf.field, label: pf.label, sublabel: pf.sublabel, placeholder: pf.placeholder, description: pf.description }); setProofSubmitUrl(""); } : undefined}
                                style={canSubmit
                                  ? ({ pressed }: any) => [styles.proofIntentItem, { backgroundColor: colors.background, borderColor: colors.primary + "60", borderStyle: "dashed", opacity: pressed ? 0.75 : 1 }]
                                  : [styles.proofIntentItem, { backgroundColor: hasValue ? "#22C55E12" : colors.background, borderColor: hasValue ? "#22C55E40" : colors.border }]}
                              >
                                <Feather name={pf.icon} size={16} color={hasValue ? "#22C55E" : canSubmit ? colors.primary : colors.mutedForeground} />
                                <Text style={[styles.proofIntentLabel, { color: hasValue ? "#22C55E" : canSubmit ? colors.primary : colors.mutedForeground }]}>{pf.label}</Text>
                                {hasValue
                                  ? <Pressable onPress={() => Linking.openURL(pf.value!)}><Text style={[styles.proofIntentLink, { color: "#22C55E" }]}>{pf.linkText}</Text></Pressable>
                                  : <Text style={[styles.proofIntentLink, { color: canSubmit ? colors.primary : colors.mutedForeground, fontFamily: canSubmit ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{canSubmit ? "+ Add proof" : "Not submitted"}</Text>}
                              </Item>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}

                  <View style={[styles.verificationBadge, { backgroundColor: isVerified ? "#22C55E18" : colors.cardElevated, borderColor: isVerified ? "#22C55E" : colors.border }]}>
                    <Feather name={isVerified ? "check-circle" : "clock"} size={28} color={isVerified ? "#22C55E" : colors.mutedForeground} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.verBadgeTitle, { color: isVerified ? "#22C55E" : colors.foreground }]}>
                        {isVerified ? "IN PROGRESS — Verified" : "IDEA — Pending Verification"}
                      </Text>
                      <Text style={[styles.verBadgeSub, { color: colors.mutedForeground }]}>
                        {isVerified ? "This project has been reviewed and approved." : "Documents are under review by validators."}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.trustCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.trustTitle, { color: colors.foreground }]}>Cumulative Trust Score</Text>
                    <View style={styles.trustRow}>
                      <View style={[styles.trustBar, { backgroundColor: colors.border }]}>
                        <View style={[styles.trustFill, { width: `${pitch.trustScore ?? 0}%` as any, backgroundColor: (pitch.trustScore ?? 0) >= 100 ? "#22C55E" : (pitch.trustScore ?? 0) >= 50 ? "#F59E0B" : "#EF4444" }]} />
                      </View>
                      <Text style={[styles.trustScore, { color: colors.foreground }]}>{pitch.trustScore ?? 0}/100</Text>
                    </View>
                    <Text style={[styles.trustCheckLabel, { color: colors.mutedForeground, fontSize: 11 }]}>
                      Each of the 4 validation blocks contributes +25% when approved by a Validator or Admin.
                    </Text>
                    {(pitch.trustScore ?? 0) >= 100 && (
                      <View style={[styles.trustCheck, { backgroundColor: "#22C55E12", borderRadius: 8, padding: 8, marginTop: 4 }]}>
                        <Feather name="check-circle" size={14} color="#22C55E" />
                        <Text style={[styles.trustCheckLabel, { color: "#22C55E", fontFamily: "Inter_700Bold" }]}>100% — Auto-migrated to the Ecosystem!</Text>
                      </View>
                    )}
                  </View>

                  {VALIDATOR_BLOCKS.map(block => {
                    const approvals: Record<string, string> = (pitch as any).validatorApprovals ?? {};
                    const blockStatus = approvals[block.key];
                    const approved = blockStatus === "approve";
                    const rejected = blockStatus === "reject";
                    const isValidator = user?.role === "validator" || user?.role === "admin";
                    const bColor = approved ? "#22C55E" : rejected ? "#EF4444" : "#F59E0B";
                    const bLabel = approved ? "Approved +25%" : rejected ? "Rejected" : "Pending Review";
                    const isProcessing = validatingBlock?.startsWith(block.key + "_");
                    return (
                      <View key={block.key} style={[styles.milestoneCard, { backgroundColor: colors.card, borderColor: approved ? "#22C55E40" : colors.border, borderLeftWidth: 3, borderLeftColor: bColor }]}>
                        <View style={styles.milestoneHeader}>
                          <View style={[styles.milestoneNum, { backgroundColor: bColor + "18", borderColor: bColor }]}>
                            <Feather name={block.icon as any} size={14} color={bColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.milestoneTitle, { color: colors.foreground }]}>{block.label}</Text>
                            <Text style={[styles.milestoneMeta, { color: colors.mutedForeground }]}>+{block.points}% on approval</Text>
                          </View>
                          <View style={[styles.statusChip, { backgroundColor: bColor + "18", borderColor: bColor }]}>
                            <Text style={[styles.statusChipText, { color: bColor }]}>{bLabel}</Text>
                          </View>
                        </View>
                        <Text style={[styles.milestoneDesc, { color: colors.mutedForeground }]}>{block.description}</Text>
                        {isValidator && !isFounder && !approved && (
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                            <Pressable
                              onPress={() => handleValidateBlock(block.key, "reject")}
                              disabled={!!validatingBlock}
                              style={({ pressed }) => [styles.verifyBtn, { backgroundColor: "#EF444418", borderWidth: 1, borderColor: "#EF4444", flex: 1, opacity: pressed || !!validatingBlock ? 0.7 : 1 }]}
                            >
                              {isProcessing && validatingBlock?.endsWith("_reject") ? <ActivityIndicator size="small" color="#EF4444" /> : <><Feather name="x-circle" size={13} color="#EF4444" /><Text style={[styles.verifyBtnText, { color: "#EF4444" }]}>Reject</Text></>}
                            </Pressable>
                            <Pressable
                              onPress={() => handleValidateBlock(block.key, "approve")}
                              disabled={!!validatingBlock}
                              style={({ pressed }) => [styles.verifyBtn, { backgroundColor: "#22C55E", flex: 2, opacity: pressed || !!validatingBlock ? 0.7 : 1 }]}
                            >
                              {isProcessing && validatingBlock?.endsWith("_approve") ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="check-circle" size={13} color="#fff" /><Text style={styles.verifyBtnText}>Approve +{block.points}%</Text></>}
                            </Pressable>
                          </View>
                        )}
                        {isFounder && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#F59E0B12", borderRadius: 8, padding: 8 }}>
                            <Feather name="alert-circle" size={12} color="#F59E0B" />
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#F59E0B", flex: 1 }}>Founders cannot approve or reject their own project's verification blocks.</Text>
                          </View>
                        )}
                        {!isValidator && !isFounder && !approved && !rejected && (
                          <Text style={[styles.milestoneDesc, { color: colors.mutedForeground, fontStyle: "italic", marginTop: 6 }]}>Awaiting Validator review</Text>
                        )}
                      </View>
                    );
                  })}

                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Submitted Documents</Text>
                  <View style={[styles.updatesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {isFounder && (
                      <View style={[styles.updateComposer, { borderBottomColor: colors.border }]}>
                        <TextInput value={newDocUrl} onChangeText={setNewDocUrl} placeholder="Paste document / portfolio URL…" placeholderTextColor={colors.mutedForeground} style={[styles.updateInput, { color: colors.foreground, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
                        <Pressable onPress={handleAddDocument} disabled={addingDoc || !newDocUrl.trim()} style={({ pressed }) => [styles.updatePostBtn, { backgroundColor: colors.primary, opacity: pressed || !newDocUrl.trim() ? 0.5 : 1 }]}>
                          {addingDoc ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={14} color="#fff" />}
                        </Pressable>
                      </View>
                    )}
                    {!documents || documents.length === 0 ? (
                      <View style={styles.emptyBox}>
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No documents submitted yet.{isFounder ? "\nAdd a portfolio, pitch deck, or proof link above." : ""}</Text>
                      </View>
                    ) : (
                      documents.map((doc) => (
                        <Pressable key={doc.id} onPress={() => Linking.openURL(doc.documentUrl)} style={({ pressed }) => [styles.docRow, { borderBottomColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                          <View style={[styles.docTypeChip, { backgroundColor: colors.primary + "18" }]}>
                            <Feather name="file-text" size={12} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.docUrl, { color: colors.foreground }]} numberOfLines={1}>{doc.documentUrl}</Text>
                            <Text style={[styles.docMeta, { color: colors.mutedForeground }]}>{doc.documentType} · {timeAgo(doc.uploadedAt)}</Text>
                          </View>
                          <View style={[styles.docStatus, { backgroundColor: doc.status === "APPROVED" ? "#22C55E18" : doc.status === "REJECTED" ? "#EF444418" : "#F59E0B18", borderColor: doc.status === "APPROVED" ? "#22C55E" : doc.status === "REJECTED" ? "#EF4444" : "#F59E0B" }]}>
                            <Text style={[styles.docStatusText, { color: doc.status === "APPROVED" ? "#22C55E" : doc.status === "REJECTED" ? "#EF4444" : "#F59E0B" }]}>{doc.status}</Text>
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                </>
              )}

              {activeTab === "capsules" && (
                <>
                  {/* Founder composer */}
                  {isFounder && (
                    <View style={[styles.updatesCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
                      <View style={[styles.updateComposer, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: 13, flex: 1 }]}>📦 Post a Project Capsule</Text>
                        <Text style={[styles.milestoneMeta, { color: colors.mutedForeground }]}>+30 XP</Text>
                      </View>
                      <View style={{ padding: 12, gap: 10 }}>
                        <TextInput
                          value={capsuleTitle}
                          onChangeText={setCapsuleTitle}
                          placeholder="Week title  e.g. Week 3 — Auth shipped!"
                          placeholderTextColor={colors.mutedForeground}
                          style={[styles.updateInput, { color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                        />
                        <TextInput
                          value={capsuleBody}
                          onChangeText={setCapsuleBody}
                          placeholder="Share progress, blockers, learnings…"
                          placeholderTextColor={colors.mutedForeground}
                          multiline
                          numberOfLines={4}
                          style={[styles.updateInput, { color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, minHeight: 90, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                        />
                        <TextInput
                          value={capsuleVideoUrl}
                          onChangeText={setCapsuleVideoUrl}
                          placeholder="Video / demo URL (optional)"
                          placeholderTextColor={colors.mutedForeground}
                          style={[styles.updateInput, { color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                        />
                        <Pressable
                          onPress={handlePostCapsule}
                          disabled={postingCapsule || !capsuleTitle.trim() || !capsuleBody.trim()}
                          style={({ pressed }) => [styles.updatePostBtn, { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", opacity: pressed || postingCapsule || !capsuleTitle.trim() || !capsuleBody.trim() ? 0.55 : 1 }]}
                        >
                          {postingCapsule ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="package" size={14} color="#fff" /><Text style={[styles.verifyBtnText, { color: "#fff" }]}>Publish Capsule</Text></>}
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Capsules timeline — real or mock demo data */}
                  {(() => {
                    const hasCapsules = (capsulesData?.capsules?.length ?? 0) > 0;
                    const displayList = hasCapsules ? capsulesData!.capsules : MOCK_CAPSULES;
                    const isMockData = !hasCapsules;
                    return (
                      <>
                        {isMockData && !isFounder && (
                          <View style={{ backgroundColor: colors.primary + "12", borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "30", padding: 12, marginBottom: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
                            <Feather name="info" size={13} color={colors.primary} />
                            <Text style={[styles.milestoneMeta, { color: colors.primary, flex: 1 }]}>Sample capsules — founder hasn't shipped real updates yet.</Text>
                          </View>
                        )}
                        {isFounder && isMockData && (
                          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginBottom: 8 }]}>
                            <Feather name="package" size={28} color={colors.mutedForeground} />
                            <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>No capsules yet.{"\n"}Post your first build update above!</Text>
                          </View>
                        )}
                        {(!isFounder || hasCapsules) && displayList.map((cap) => (
                          <Pressable
                            key={cap.id}
                            onPress={() => setExpandedCapsule(expandedCapsule === cap.id ? null : cap.id)}
                            style={({ pressed }) => [styles.milestoneCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.primary, opacity: pressed ? 0.95 : 1 }]}
                          >
                            <View style={styles.milestoneHeader}>
                              <View style={[styles.milestoneNum, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "50" }]}>
                                <Text style={[styles.milestoneMeta, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>W{cap.weekNumber}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.milestoneTitle, { color: colors.foreground }]}>{cap.title}</Text>
                                <Text style={[styles.milestoneMeta, { color: colors.mutedForeground }]}>{timeAgo(cap.createdAt)}{isMockData ? " · demo" : ""}</Text>
                              </View>
                              {cap.videoUrl && (
                                <Pressable onPress={() => Linking.openURL(cap.videoUrl!)} style={[styles.statusChip, { backgroundColor: "#8B5CF618", borderColor: "#8B5CF640" }]}>
                                  <Feather name="play-circle" size={12} color="#8B5CF6" />
                                  <Text style={[styles.statusChipText, { color: "#8B5CF6" }]}>Demo</Text>
                                </Pressable>
                              )}
                              <Feather name={expandedCapsule === cap.id ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                            </View>
                            <Text style={[styles.milestoneDesc, { color: colors.mutedForeground, lineHeight: 20 }]} numberOfLines={expandedCapsule === cap.id ? undefined : 2}>{cap.body}</Text>
                            {expandedCapsule === cap.id && !isMockData && (
                              <Pressable
                                onPress={() => { setTipCapsuleId(cap.id); setTipAmount("1"); setTipSuccess(false); }}
                                style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, gap: 6, alignSelf: "flex-start" as const, marginTop: 10, backgroundColor: "#F59E0B18", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#F59E0B40", opacity: pressed ? 0.8 : 1 })}
                              >
                                <Feather name="zap" size={12} color="#F59E0B" />
                                <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>Micro-Tip</Text>
                              </Pressable>
                            )}
                          </Pressable>
                        ))}
                      </>
                    );
                  })()}

                  {/* Micro-Tip Modal */}
                  <Modal visible={!!tipCapsuleId} transparent animationType="slide" onRequestClose={() => { setTipCapsuleId(null); setTipSuccess(false); }}>
                    <View style={styles.modalOverlay}>
                      <View style={[styles.escrowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.escrowHeader, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.escrowTitle, { color: colors.foreground, fontSize: 17 }]}>{tipSuccess ? "Tip Sent! ⚡" : "Micro-Tip the Founder"}</Text>
                          <Pressable onPress={() => { setTipCapsuleId(null); setTipSuccess(false); }} hitSlop={10}>
                            <Feather name="x" size={20} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                        <View style={{ padding: 20, gap: 14 }}>
                          {tipSuccess ? (
                            <>
                              <View style={{ alignItems: "center", gap: 12 }}>
                                <View style={{ backgroundColor: "#F59E0B20", borderRadius: 50, padding: 18 }}>
                                  <Feather name="zap" size={36} color="#F59E0B" />
                                </View>
                                <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>π {tipAmount} sent to the founder!</Text>
                                <Text style={[styles.milestoneMeta, { color: colors.mutedForeground, textAlign: "center" }]}>Your tip fuels the builder's momentum. Keep shipping! 🚀</Text>
                              </View>
                              <Pressable onPress={() => { setTipCapsuleId(null); setTipSuccess(false); }} style={[styles.verifyBtn, { backgroundColor: "#F59E0B" }]}>
                                <Text style={[styles.verifyBtnText, { color: "#fff" }]}>Done</Text>
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <View style={{ backgroundColor: "#F59E0B10", borderRadius: 12, borderWidth: 1, borderColor: "#F59E0B30", padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
                                <Feather name="zap" size={14} color="#F59E0B" />
                                <Text style={[styles.milestoneMeta, { color: "#F59E0B", flex: 1 }]}>Fuel the builder directly. No escrow, no contract — pure momentum.</Text>
                              </View>
                              <Text style={[styles.milestoneMeta, { color: colors.mutedForeground }]}>Choose amount (π)</Text>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                {["1", "5", "10", "25"].map((v) => (
                                  <Pressable key={v} onPress={() => setTipAmount(v)} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: tipAmount === v ? "#F59E0B" : colors.border, backgroundColor: tipAmount === v ? "#F59E0B18" : colors.background }}>
                                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: tipAmount === v ? "#F59E0B" : colors.foreground }}>π {v}</Text>
                                  </Pressable>
                                ))}
                              </View>
                              <Pressable onPress={handleTipCapsule} disabled={tipping} style={[styles.verifyBtn, { backgroundColor: "#F59E0B", opacity: tipping ? 0.7 : 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }]}>
                                {tipping ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="zap" size={14} color="#fff" /><Text style={[styles.verifyBtnText, { color: "#fff" }]}>Send π {tipAmount} Tip</Text></>}
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </Modal>
                </>
              )}
            </View>
          </ScrollView>
        </>
      )}

      <Modal visible={showEscrowModal} transparent animationType="slide" onRequestClose={() => { if (escrowStep !== "initiating" && escrowStep !== "locking") { if (escrowStep === "active") { setIsExpressedInterest(true); setShowEscrowModal(false); } else { setShowEscrowModal(false); } } }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.escrowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {escrowStep === "active" ? (
              <>
                <View style={[styles.escrowSuccess, { backgroundColor: "#22C55E18" }]}>
                  <Feather name="check-circle" size={40} color="#22C55E" />
                </View>
                <Text style={[styles.escrowTitle, { color: "#22C55E" }]}>Agreement Active!</Text>
                <Text style={[styles.escrowSub, { color: colors.mutedForeground }]}>Your π are locked in escrow and will be released as milestones are verified.</Text>
                {escrowResult && (
                  <View style={[styles.hashBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.hashLabel, { color: colors.mutedForeground }]}>Agreement ID</Text>
                    <Text style={[styles.hashValue, { color: colors.foreground }]}>{escrowResult.id}</Text>
                    <Text style={[styles.hashLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Terms Hash</Text>
                    <Text style={[styles.hashValue, { color: colors.foreground }]}>{shortHash(escrowResult.termsHash)}</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => {
                    setIsExpressedInterest(true);
                    setShowEscrowModal(false);
                    setActiveTab("milestones");
                  }}
                  style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: "#22C55E", opacity: pressed ? 0.85 : 1 }]}
                >
                  <Feather name="layers" size={15} color="#fff" />
                  <Text style={styles.escrowConfirmBtnText}>View Milestones</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsExpressedInterest(true);
                    setShowEscrowModal(false);
                  }}
                  style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#22C55E40", marginTop: 0, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.escrowConfirmBtnText, { color: "#22C55E" }]}>Back to Project</Text>
                </Pressable>
              </>
            ) : escrowStep === "initiating" || escrowStep === "locking" ? (
              <>
                <View style={[styles.escrowSuccess, { backgroundColor: colors.primary + "18" }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
                <Text style={[styles.escrowTitle, { color: colors.foreground }]}>
                  {escrowStep === "initiating" ? "Initiating Pi Wallet Connection…" : "Locking Funds in Escrow…"}
                </Text>
                <View style={styles.stepRow}>
                  <StepDot done={true} active={escrowStep === "initiating"} label="Connect Wallet" color={colors.primary} />
                  <View style={[styles.stepLine, { backgroundColor: escrowStep === "locking" ? colors.primary : colors.border }]} />
                  <StepDot done={escrowStep === "locking"} active={escrowStep === "locking"} label="Lock Escrow" color={colors.primary} />
                  <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
                  <StepDot done={false} active={false} label="Active" color={colors.primary} />
                </View>
              </>
            ) : (
              <>
                <View style={[styles.escrowHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.escrowTitle, { color: colors.foreground }]}>Smart Escrow Agreement</Text>
                  <Pressable onPress={() => setShowEscrowModal(false)} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
                </View>

                <View style={[styles.escrowProject, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.escrowProjectLabel, { color: colors.mutedForeground }]}>Project</Text>
                  <Text style={[styles.escrowProjectName, { color: colors.foreground }]}>{pitch?.title}</Text>
                  <Text style={[styles.escrowProjectId, { color: colors.mutedForeground }]}>ID: {id}</Text>
                </View>

                <Text style={[styles.escrowAmtLabel, { color: colors.mutedForeground }]}>Amount to commit (π)</Text>
                <View style={[styles.escrowAmtRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.escrowPi, { color: colors.primary }]}>π</Text>
                  <TextInput
                    value={escrowAmount}
                    onChangeText={(v) => setEscrowAmount(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    style={[styles.escrowAmtInput, { color: colors.foreground, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                  />
                </View>

                <View style={[styles.escrowTerms, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.escrowTermsTitle, { color: colors.foreground }]}>Agreement Terms</Text>
                  <Text style={[styles.escrowTermsBody, { color: colors.mutedForeground }]}>
                    • Funds locked in escrow until milestones verified{"\n"}
                    • 3 phases: 30% → 40% → 30% release{"\n"}
                    • 30-day refund window if no activity{"\n"}
                    • Cryptographic terms hash recorded on-chain
                  </Text>
                </View>

                <Pressable onPress={confirmEscrow} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: stageColor, opacity: pressed ? 0.85 : 1 }]}>
                  <Feather name="lock" size={15} color="#fff" />
                  <Text style={styles.escrowConfirmBtnText}>Lock {escrowAmount || "0"} π in Escrow</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Donate Modal */}
      <Modal visible={showDonateModal} transparent animationType="slide" onRequestClose={() => setShowDonateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {donateSuccess ? (
              <>
                <View style={[styles.escrowSuccess, { backgroundColor: "#EF444418" }]}><Feather name="heart" size={36} color="#EF4444" /></View>
                <Text style={[styles.escrowTitle, { color: "#EF4444" }]}>Donation Sent!</Text>
                <Text style={[styles.escrowSub, { color: colors.mutedForeground }]}>{donateAmount} π donated directly to this project. Thank you for your support!</Text>
                <Pressable onPress={() => setShowDonateModal(false)} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: "#EF4444", opacity: pressed ? 0.85 : 1, marginTop: 16 }]}>
                  <Text style={styles.escrowConfirmBtnText}>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={[styles.escrowHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.escrowTitle, { color: colors.foreground }]}>Donate to Project</Text>
                  <Pressable onPress={() => setShowDonateModal(false)} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
                </View>
                <Text style={[styles.escrowAmtLabel, { color: colors.mutedForeground }]}>Donation amount (π)</Text>
                <View style={[styles.escrowAmtRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.escrowPi, { color: "#EF4444" }]}>π</Text>
                  <TextInput value={donateAmount} onChangeText={(v) => setDonateAmount(v.replace(/[^0-9]/g, ""))} keyboardType="numeric" style={[styles.escrowAmtInput, { color: colors.foreground }]} />
                </View>
                <View style={[styles.escrowTerms, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.escrowTermsBody, { color: colors.mutedForeground }]}>• Funds sent directly to project founder{"\n"}• No escrow — immediate transfer{"\n"}• Non-refundable goodwill donation</Text>
                </View>
                <Pressable onPress={handleDonate} disabled={donating} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: "#EF4444", opacity: pressed || donating ? 0.75 : 1 }]}>
                  {donating ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="heart" size={15} color="#fff" /><Text style={styles.escrowConfirmBtnText}>Donate {donateAmount || "0"} π</Text></>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Send Offer Modal */}
      <Modal visible={showOfferModal} transparent animationType="slide" onRequestClose={() => setShowOfferModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {offerSent ? (
              <>
                <View style={[styles.escrowSuccess, { backgroundColor: colors.primary + "18" }]}><Feather name="send" size={36} color={colors.primary} /></View>
                <Text style={[styles.escrowTitle, { color: colors.primary }]}>Offer Sent!</Text>
                <Text style={[styles.escrowSub, { color: colors.mutedForeground }]}>Your offer has been recorded. The founder will be notified and can respond to your interest.</Text>
                <Pressable onPress={() => setShowOfferModal(false)} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 16 }]}>
                  <Text style={styles.escrowConfirmBtnText}>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={[styles.escrowHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.escrowTitle, { color: colors.foreground }]}>Send Offer</Text>
                  <Pressable onPress={() => setShowOfferModal(false)} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
                </View>
                <Text style={[styles.escrowAmtLabel, { color: colors.mutedForeground }]}>Your message / offer details</Text>
                <TextInput
                  value={offerNote}
                  onChangeText={setOfferNote}
                  placeholder="Describe your offer, partnership interest, or proposal…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[styles.reportInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Text style={[styles.escrowAmtLabel, { color: colors.mutedForeground, marginTop: 12 }]}>Optional: commit π amount</Text>
                <View style={[styles.escrowAmtRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.escrowPi, { color: colors.primary }]}>π</Text>
                  <TextInput value={offerAmount} onChangeText={(v) => setOfferAmount(v.replace(/[^0-9]/g, ""))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.mutedForeground} style={[styles.escrowAmtInput, { color: colors.foreground }]} />
                </View>
                <Pressable onPress={handleSendOffer} disabled={sendingOffer} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: colors.primary, opacity: pressed || sendingOffer ? 0.75 : 1 }]}>
                  {sendingOffer ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="send" size={15} color="#fff" /><Text style={styles.escrowConfirmBtnText}>Send Offer</Text></>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Proof Submission Modal — founder submits proof URL for a validation block */}
      <Modal visible={!!proofSubmitBlock} transparent animationType="fade" onRequestClose={() => setProofSubmitBlock(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "center", padding: 24 }}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setProofSubmitBlock(null)} />
          <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                <Feather name="link" size={17} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Submit Proof</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: 1 }}>{proofSubmitBlock?.sublabel}</Text>
              </View>
              <Pressable onPress={() => setProofSubmitBlock(null)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
              {proofSubmitBlock?.description ?? "Paste a public, verifiable URL. Once submitted, a Network Validator will review and approve this block (+25% trust score)."}
            </Text>
            <View style={{ backgroundColor: colors.primary + "10", borderRadius: 10, borderWidth: 1, borderColor: colors.primary + "25", padding: 10, flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Feather name="info" size={11} color={colors.primary} />
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.primary, flex: 1 }}>Once submitted, a Network Validator will review this block (+25% trust score per approval).</Text>
            </View>
            <TextInput
              value={proofSubmitUrl}
              onChangeText={setProofSubmitUrl}
              placeholder={proofSubmitBlock?.placeholder ?? "https://..."}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, backgroundColor: colors.background }, Platform.OS === "web" ? { outlineStyle: "none" as any } : {}]}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setProofSubmitBlock(null)}
                style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" as const, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProofUrl}
                disabled={savingProofUrl || !proofSubmitUrl.trim()}
                style={({ pressed }) => ({ flex: 2, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" as const, opacity: pressed || savingProofUrl || !proofSubmitUrl.trim() ? 0.55 : 1 })}
              >
                {savingProofUrl
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>Submit for Review</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {reportSent ? (
              <><Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Sent</Text><Text style={[styles.modalBody, { color: colors.mutedForeground }]}>Thank you. Our team will review this project.</Text><Pressable onPress={() => { setShowReportModal(false); setReportSent(false); }} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, marginTop: 16 }]}><Text style={styles.escrowConfirmBtnText}>Close</Text></Pressable></>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Project</Text>
                <TextInput value={reportReason} onChangeText={setReportReason} placeholder="Describe the issue…" placeholderTextColor={colors.mutedForeground} multiline style={[styles.reportInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setShowReportModal(false)} style={({ pressed }) => [styles.modalCancel, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancel</Text></Pressable>
                  <Pressable onPress={handleReport} style={({ pressed }) => [styles.modalConfirm, { backgroundColor: "#EF4444", opacity: pressed ? 0.8 : 1 }]}><Text style={styles.modalConfirmText}>Submit Report</Text></Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Badge({ label, color, icon }: { label: string; color: string; icon?: string }) {
  return (
    <View style={[bStyles.badge, { backgroundColor: color + "18", borderColor: color + "40" }]}>
      {icon ? <Feather name={icon as any} size={10} color={color} style={{ marginRight: 3 }} /> : null}
      <Text style={[bStyles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={[styles.miniStatVal, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function TrustCheck({ label, done, colors }: { label: string; done: boolean; colors: any }) {
  return (
    <View style={styles.trustCheck}>
      <Feather name={done ? "check-circle" : "circle"} size={14} color={done ? "#22C55E" : colors.mutedForeground} />
      <Text style={[styles.trustCheckLabel, { color: done ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function StepDot({ done, active, label, color }: { done: boolean; active: boolean; label: string; color: string }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={[styles.stepDot, { backgroundColor: done ? color : "#6B728030", borderColor: done ? color : "#6B7280" }]}>
        {active ? <ActivityIndicator size="small" color="#fff" /> : <Feather name={done ? "check" : "circle"} size={10} color={done ? "#fff" : "#6B7280"} />}
      </View>
      <Text style={{ fontSize: 10, color: done ? color : "#6B7280" }}>{label}</Text>
    </View>
  );
}

const bStyles = StyleSheet.create({ badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 }, badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" } });

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 10 },
  topBarTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  reportBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  hero: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  heroIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 4 },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  body: { padding: 16, gap: 0 },
  summary: { fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular", marginBottom: 16 },
  fundingCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 10 },
  fundingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  fundingAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  fundingLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pctText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  miniStatVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  miniStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  proofRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  proofBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  proofBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  investBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15, marginBottom: 20 },
  investBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  proofIntentCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16, gap: 14 },
  proofIntentHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  proofIntentTitle: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  proofIntentSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
  proofIntentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  proofIntentItem: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  proofIntentLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  proofIntentLink: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 8, marginBottom: 10 },
  founderCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  founderNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  founderName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  founderRole: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  founderCity: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  supportersCard: { borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  supporterRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  supporterName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  supporterHandle: { fontSize: 11, fontFamily: "Inter_400Regular" },
  updatesCard: { borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  updateComposer: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, gap: 10 },
  updateInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", maxHeight: 80 },
  updatePostBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  updateItem: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  updateItemHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  updateItemTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  updateItemContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  relatedCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  relatedIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  relatedTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  relatedMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyBox: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  milestoneCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  milestoneHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  milestoneNum: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  milestoneNumText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  milestoneTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  milestoneMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  milestoneDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 8 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  proofInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: "Inter_400Regular" },
  submitProofBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  submitProofBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  verifyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10, marginTop: 12 },
  verifyBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  completedText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 8 },
  verificationBadge: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 16 },
  verBadgeTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  verBadgeSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },
  trustCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  trustTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 12 },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  trustBar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  trustFill: { height: 8, borderRadius: 4 },
  trustScore: { fontSize: 14, fontFamily: "Inter_700Bold", width: 48 },
  trustChecks: { gap: 8 },
  trustCheck: { flexDirection: "row", alignItems: "center", gap: 8 },
  trustCheckLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  docRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  docTypeChip: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docUrl: { fontSize: 12, fontFamily: "Inter_500Medium" },
  docMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  docStatus: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  docStatusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  escrowCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, gap: 16 },
  escrowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  escrowTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  escrowSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, textAlign: "center" },
  escrowSuccess: { alignItems: "center", justifyContent: "center", borderRadius: 50, width: 80, height: 80, alignSelf: "center" },
  escrowProject: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 2 },
  escrowProjectLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  escrowProjectName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  escrowProjectId: { fontSize: 10, fontFamily: "Inter_400Regular" },
  escrowAmtLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  escrowAmtRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, height: 52 },
  escrowPi: { fontSize: 22, fontFamily: "Inter_700Bold", marginRight: 8 },
  escrowAmtInput: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  escrowTerms: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  escrowTermsTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  escrowTermsBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 20 },
  escrowConfirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15 },
  escrowConfirmBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  hashBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 2 },
  hashLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  hashValue: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 24, height: 2, borderRadius: 1 },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: 24, margin: 24, gap: 12 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalConfirm: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalConfirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  reportInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
});
