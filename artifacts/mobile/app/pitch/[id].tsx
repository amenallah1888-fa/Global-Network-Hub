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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Pitch, User } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

type PitchUpdate = { id: string; pitchId: string; authorId: string; content: string; createdAt: string };
type Supporter = { id: string; name: string; avatarKey: string | null; handle: string };
type Milestone = { id: string; pitchId: string; proposalId: string; title: string; description: string; percentageOfFunds: number; status: string; proofUrl: string | null; completedAt: string | null; order: number };
type ProjectDocument = { id: string; projectId: string; documentUrl: string; documentType: string; status: string; reviewNote: string | null; uploadedAt: string };
type PitchDetail = Pitch & { founder: (User & { following?: boolean }) | null; related: (Pitch & { verified?: boolean })[]; supporters?: Supporter[]; verified?: boolean; trustScore?: number; entityType?: string; serviceCategory?: string; verificationStatus?: string; roadmapUrl?: string | null; founderLinkedin?: string | null; proofOfRealityUrl?: string | null; portfolioUrl?: string | null; experienceDescription?: string | null };
type ActiveTab = "overview" | "milestones" | "verification";
type EscrowStep = "idle" | "initiating" | "locking" | "active";

function formatPi(n: number) { return `${n.toLocaleString()} π`; }
function pct(raised: number, raising: number) { if (!raising) return 0; return Math.min(100, Math.round((raised / raising) * 100)); }
function timeAgo(dateStr: string) { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return `${Math.floor(hrs / 24)}d ago`; }
function shortHash(h: string) { return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "—"; }

const STAGE_COLOR: Record<string, string> = { "Pre-seed": "#F97316", Seed: "#EAB308", "Series A": "#22C55E", "Series B": "#3B82F6", "Series C": "#8B5CF6" };
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

  const { data: pitch, isLoading } = useQuery<PitchDetail>({
    queryKey: [`/api/pitches/${id}`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${id}`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) throw new Error("Not found"); return res.json(); },
    enabled: !!id && !!token,
    staleTime: 15_000,
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

      {isLoading || !pitch ? (
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
              {(["overview", "milestones", "verification"] as ActiveTab[]).map((tab) => (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabBtn, { borderBottomColor: activeTab === tab ? colors.primary : "transparent" }]}>
                  <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                    {tab === "overview" ? "Overview" : tab === "milestones" ? "Milestones" : "Verification"}
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

                  {!pitch.backed ? (
                    <Pressable onPress={handleInvest} style={({ pressed }) => [styles.investBtn, { backgroundColor: stageColor, opacity: pressed ? 0.85 : 1 }]}>
                      <Feather name={isServiceApp ? "tool" : "trending-up"} size={16} color="#fff" />
                      <Text style={[styles.investBtnText, { color: "#fff" }]}>{actionLabel}</Text>
                    </Pressable>
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
                      Funds are released phase-by-phase as milestones are completed and verified by backers.
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

                          {!isFounder && m.status === "pending_proof" && (
                            <Pressable onPress={() => handleVerifyMilestone(m.id)} style={({ pressed }) => [styles.verifyBtn, { backgroundColor: "#22C55E", opacity: pressed ? 0.8 : 1 }]}>
                              <Feather name="check" size={14} color="#fff" />
                              <Text style={styles.verifyBtnText}>Verify Milestone & Release Funds</Text>
                            </Pressable>
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

                  {pitch.trustScore !== undefined && (
                    <View style={[styles.trustCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.trustTitle, { color: colors.foreground }]}>Trust Score</Text>
                      <View style={styles.trustRow}>
                        <View style={[styles.trustBar, { backgroundColor: colors.border }]}>
                          <View style={[styles.trustFill, { width: `${pitch.trustScore}%` as any, backgroundColor: pitch.trustScore >= 70 ? "#22C55E" : pitch.trustScore >= 40 ? "#F59E0B" : "#EF4444" }]} />
                        </View>
                        <Text style={[styles.trustScore, { color: colors.foreground }]}>{pitch.trustScore}/100</Text>
                      </View>
                      <View style={styles.trustChecks}>
                        <TrustCheck label="Proof of Reality" done={!!pitch.proofOfRealityUrl} colors={colors} />
                        <TrustCheck label="Founder LinkedIn" done={!!pitch.founderLinkedin} colors={colors} />
                        <TrustCheck label="Roadmap" done={!!pitch.roadmapUrl} colors={colors} />
                        <TrustCheck label="Portfolio" done={!!pitch.portfolioUrl} colors={colors} />
                      </View>
                    </View>
                  )}

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
            </View>
          </ScrollView>
        </>
      )}

      <Modal visible={showEscrowModal} transparent animationType="slide" onRequestClose={() => { if (escrowStep !== "initiating" && escrowStep !== "locking") setShowEscrowModal(false); }}>
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
                <Pressable onPress={() => { setShowEscrowModal(false); setActiveTab("milestones"); }} style={({ pressed }) => [styles.escrowConfirmBtn, { backgroundColor: "#22C55E", opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={styles.escrowConfirmBtnText}>View Milestones</Text>
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
