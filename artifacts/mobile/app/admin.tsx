import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

type PendingDoc = { id: string; projectId: string; documentUrl: string; documentType: string; status: string; reviewNote: string | null; uploadedAt: string };
type PendingPitch = { id: string; title: string; summary: string; city: string; industry: string; stage: string; raised: number; backersCount: number };

function timeAgo(dateStr: string) { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return `${Math.floor(hrs / 24)}d ago`; }

type AdminTab = "documents" | "projects" | "reputation";

const REP_EVENTS = [
  { type: "kyc_verified", label: "KYC Verified", emoji: "🛡️", delta: 15 },
  { type: "escrow_completed", label: "Escrow Completed", emoji: "✅", delta: 10 },
  { type: "escrow_dispute_won", label: "Won a Dispute", emoji: "🏆", delta: 5 },
  { type: "jury_accurate_vote", label: "Accurate Jury Vote", emoji: "⚖️", delta: 4 },
  { type: "milestone_delivered", label: "Milestone Delivered", emoji: "🚀", delta: 3 },
  { type: "review_received", label: "Review Received", emoji: "⭐", delta: 2 },
  { type: "jury_inaccurate_vote", label: "Inaccurate Jury Vote", emoji: "❌", delta: -3 },
  { type: "escrow_dispute_lost", label: "Lost a Dispute", emoji: "💸", delta: -10 },
];

const DISPUTE_PHASES = [
  { icon: "⏰", title: "Timelock (24h)", desc: "After a dispute is raised, the other party has 24 hours to respond or resolve directly." },
  { icon: "🤖", title: "AI Analysis", desc: "If unresolved, the AI analyzes the dispute reason and chat history, producing a recommendation." },
  { icon: "👥", title: "Jury Vote (72h)", desc: "5 KYC-verified users with 10+ reputation are selected as jurors and vote within 72 hours." },
  { icon: "⚖️", title: "Verdict & Reputation", desc: "Majority wins. Accurate jurors earn +4 rep, inaccurate lose −3. The dispute loser loses −10 rep." },
];

const REP_TIERS = [
  { min: 0, max: 9, label: "Newcomer", emoji: "🌱", color: "#6B7280", nextLabel: "Builder", nextAt: 10 },
  { min: 10, max: 24, label: "Builder", emoji: "⭐", color: "#3B82F6", nextLabel: "Trusted", nextAt: 25 },
  { min: 25, max: 49, label: "Trusted", emoji: "🌟", color: "#22C55E", nextLabel: "Expert", nextAt: 50 },
  { min: 50, max: 99, label: "Expert", emoji: "🏆", color: "#F59E0B", nextLabel: "Legend", nextAt: 100 },
  { min: 100, max: Infinity, label: "Legend", emoji: "💎", color: "#8B5CF6", nextLabel: "Legend", nextAt: 100 },
];

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user, setSession } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("documents");
  const [processing, setProcessing] = useState<string | null>(null);
  const [promotingValidator, setPromotingValidator] = useState(false);

  const isValidator = user?.role === "validator" || user?.role === "admin";
  const repScore = user?.reputationScore ?? 0;
  const repTier = REP_TIERS.find(t => repScore >= t.min && repScore <= t.max) ?? REP_TIERS[0];
  const userLevel = repScore >= 100 ? 5 : repScore >= 50 ? 4 : repScore >= 25 ? 3 : repScore >= 10 ? 2 : 1;
  const meetsValidatorCriteria = repScore >= 85 && userLevel >= 5;
  const showLockedView = !isValidator && !meetsValidatorCriteria;

  const becomeValidator = async () => {
    setPromotingValidator(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/promote-validator`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setSession(token!, { ...user!, role: updated.role });
      Alert.alert("Validator Mode Activated!", "You can now approve or reject trust blocks on any project's Verification tab.");
    } catch { Alert.alert("Error", "Could not activate validator mode"); } finally { setPromotingValidator(false); }
  };

  const { data, isLoading, refetch } = useQuery<{ documents: PendingDoc[]; pitches: PendingPitch[] }>({
    queryKey: ["/api/admin/pending"],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/admin/pending`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) throw new Error("Failed"); return res.json(); },
    enabled: !!token,
    staleTime: 10_000,
  });

  const approveDoc = async (docId: string) => {
    setProcessing(docId);
    try {
      await fetch(`${API_BASE}/api/project-documents/${docId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", reviewNote: "Reviewed and approved by validator." }),
      });
      refetch();
    } catch { Alert.alert("Error", "Could not approve document"); } finally { setProcessing(null); }
  };

  const rejectDoc = async (docId: string) => {
    Alert.alert("Reject Document", "This will mark the document as rejected.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => {
        setProcessing(docId);
        try {
          await fetch(`${API_BASE}/api/project-documents/${docId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "REJECTED", reviewNote: "Document does not meet requirements." }),
          });
          refetch();
        } catch { Alert.alert("Error", "Could not reject document"); } finally { setProcessing(null); }
      }},
    ]);
  };

  const verifyPitch = async (pitchId: string, title: string) => {
    Alert.alert("Verify Project", `Mark "${title}" as IN_PROGRESS (verified)?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Verify", onPress: async () => {
        setProcessing(pitchId);
        try {
          await fetch(`${API_BASE}/api/pitches/${pitchId}/verify`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "verified" }),
          });
          qc.invalidateQueries({ queryKey: ["/api/pitches"] });
          refetch();
        } catch { Alert.alert("Error", "Could not verify project"); } finally { setProcessing(null); }
      }},
    ]);
  };

  const docs = data?.documents ?? [];
  const pitches = data?.pitches ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Validator Panel</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Review and approve submissions</Text>
        </View>
        <Pressable onPress={() => refetch()} hitSlop={10} style={({ pressed }) => [styles.refreshBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="refresh-cw" size={15} color={colors.foreground} />
        </Pressable>
      </View>

      {showLockedView && (
        <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 52, gap: 18 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", gap: 14 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "#F59E0B18", borderWidth: 2, borderColor: "#F59E0B50", alignItems: "center", justifyContent: "center" }}>
              <Feather name="lock" size={38} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" }}>Validator Portal Locked</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 22 }}>
              Meet all three requirements below to unlock the Active Dispute Room and full Validator tools.
            </Text>
          </View>

          {[
            { label: "Reputation Score", icon: "star" as const,       current: `${repScore} pts`, required: "≥ 85 pts",  met: repScore >= 85 },
            { label: "Ecosystem Level",  icon: "trending-up" as const, current: `Level ${userLevel}`,  required: "≥ Level 5", met: userLevel >= 5 },
            { label: "KYC Identity",     icon: "user-check" as const,  current: user?.kycStatus === "verified" ? "Verified" : "Pending", required: "Verified", met: user?.kycStatus === "verified" },
          ].map(req => (
            <View key={req.label} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: req.met ? "#22C55E40" : colors.border, backgroundColor: req.met ? "#22C55E08" : colors.card }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: req.met ? "#22C55E18" : "#6B728018", alignItems: "center", justifyContent: "center" }}>
                <Feather name={req.icon} size={18} color={req.met ? "#22C55E" : "#6B7280"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{req.label}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                  Now: <Text style={{ fontFamily: "Inter_700Bold", color: req.met ? "#22C55E" : colors.foreground }}>{req.current}</Text>
                  {"  ·  "}Need: <Text style={{ fontFamily: "Inter_700Bold" }}>{req.required}</Text>
                </Text>
              </View>
              <Feather name={req.met ? "check-circle" : "circle"} size={22} color={req.met ? "#22C55E" : "#4B5563"} />
            </View>
          ))}

          <View style={{ backgroundColor: colors.primary + "10", borderRadius: 14, borderWidth: 1, borderColor: colors.primary + "30", padding: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.primary }}>How to earn reputation</Text>
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 20 }}>
              Back projects · Complete escrow agreements · Deliver milestones · Receive 5-star reviews · Post Project Capsules
            </Text>
          </View>

          <Pressable
            onPress={becomeValidator}
            disabled={promotingValidator}
            style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, backgroundColor: colors.primary + "18", borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: colors.primary, opacity: pressed || promotingValidator ? 0.7 : 1 })}
          >
            {promotingValidator
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <><Feather name="shield" size={15} color={colors.primary} /><Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.primary }}>Demo: Activate Validator Mode</Text></>}
          </Pressable>
        </ScrollView>
      )}

      {!showLockedView && (
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {(["documents", "projects", "reputation"] as AdminTab[]).map(tab => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabBtn, { borderBottomColor: activeTab === tab ? colors.primary : "transparent" }]}>
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                {tab === "documents" ? `Docs${docs.length > 0 ? ` (${docs.length})` : ""}` : tab === "projects" ? `Projects${pitches.length > 0 ? ` (${pitches.length})` : ""}` : "Reputation"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!showLockedView && (isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.validatorCard, { backgroundColor: isValidator ? "#22C55E12" : colors.card, borderColor: isValidator ? "#22C55E40" : colors.border }]}>
            <View style={styles.validatorCardRow}>
              <View style={[styles.validatorIcon, { backgroundColor: isValidator ? "#22C55E18" : colors.cardElevated }]}>
                <Feather name="shield" size={20} color={isValidator ? "#22C55E" : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.validatorTitle, { color: colors.foreground }]}>
                  {isValidator ? "Validator Mode Active" : "Activate Validator Mode"}
                </Text>
                <Text style={[styles.validatorSub, { color: colors.mutedForeground }]}>
                  {isValidator ? "You can approve or reject trust blocks on any project's Verification tab." : "Enables block-by-block approval of projects. Each block adds +25% trust score."}
                </Text>
              </View>
            </View>
            {!isValidator && (
              <Pressable
                onPress={becomeValidator}
                disabled={promotingValidator}
                style={({ pressed }) => [styles.validatorBtn, { backgroundColor: colors.primary, opacity: pressed || promotingValidator ? 0.7 : 1 }]}
              >
                {promotingValidator ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="shield" size={14} color="#fff" /><Text style={styles.validatorBtnText}>Become a Validator</Text></>}
              </Pressable>
            )}
            {isValidator && (
              <View style={[styles.validatorRoleBadge, { backgroundColor: "#22C55E18", borderColor: "#22C55E40" }]}>
                <Feather name="check-circle" size={12} color="#22C55E" />
                <Text style={[styles.validatorRoleText, { color: "#22C55E" }]}>Role: {user?.role?.toUpperCase()}</Text>
              </View>
            )}
          </View>
          {activeTab === "documents" && (
            docs.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="check-circle" size={40} color="#22C55E" />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>No pending documents to review.</Text>
              </View>
            ) : (
              docs.map(doc => (
                <View key={doc.id} style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.docHeader}>
                    <View style={[styles.docIcon, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name="file-text" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docType, { color: colors.foreground }]}>{doc.documentType.toUpperCase()}</Text>
                      <Text style={[styles.docTime, { color: colors.mutedForeground }]}>Submitted {timeAgo(doc.uploadedAt)}</Text>
                    </View>
                    <View style={[styles.pendingChip, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B" }]}>
                      <Text style={[styles.pendingChipText, { color: "#F59E0B" }]}>PENDING</Text>
                    </View>
                  </View>

                  <Pressable onPress={() => Linking.openURL(doc.documentUrl)} style={({ pressed }) => [styles.docUrl, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                    <Feather name="external-link" size={12} color={colors.primary} />
                    <Text style={[styles.docUrlText, { color: colors.primary }]} numberOfLines={1}>{doc.documentUrl}</Text>
                  </Pressable>

                  <Text style={[styles.docProjectLabel, { color: colors.mutedForeground }]}>Project: <Text style={{ color: colors.foreground }}>{doc.projectId}</Text></Text>

                  <View style={styles.docActions}>
                    <Pressable
                      onPress={() => rejectDoc(doc.id)}
                      disabled={processing === doc.id}
                      style={({ pressed }) => [styles.docActionBtn, { backgroundColor: "#EF444418", borderColor: "#EF4444", opacity: pressed || processing === doc.id ? 0.7 : 1 }]}
                    >
                      {processing === doc.id ? <ActivityIndicator size="small" color="#EF4444" /> : <><Feather name="x-circle" size={14} color="#EF4444" /><Text style={[styles.docActionText, { color: "#EF4444" }]}>Reject</Text></>}
                    </Pressable>
                    <Pressable
                      onPress={() => approveDoc(doc.id)}
                      disabled={processing === doc.id}
                      style={({ pressed }) => [styles.docActionBtn, { backgroundColor: "#22C55E18", borderColor: "#22C55E", opacity: pressed || processing === doc.id ? 0.7 : 1, flex: 1.5 }]}
                    >
                      {processing === doc.id ? <ActivityIndicator size="small" color="#22C55E" /> : <><Feather name="check-circle" size={14} color="#22C55E" /><Text style={[styles.docActionText, { color: "#22C55E" }]}>Approve Document</Text></>}
                    </Pressable>
                  </View>
                </View>
              ))
            )
          )}

          {activeTab === "projects" && (
            pitches.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="check-circle" size={40} color="#22C55E" />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>No projects pending verification.</Text>
              </View>
            ) : (
              pitches.map(pitch => (
                <View key={pitch.id} style={[styles.pitchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.pitchHeader}>
                    <View style={[styles.pitchIcon, { backgroundColor: colors.accent + "18" }]}>
                      <Feather name="zap" size={16} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pitchTitle, { color: colors.foreground }]}>{pitch.title}</Text>
                      <Text style={[styles.pitchMeta, { color: colors.mutedForeground }]}>{pitch.stage} · {pitch.industry} · {pitch.city}</Text>
                    </View>
                    <View style={[styles.pendingChip, { backgroundColor: "#6B728018", borderColor: "#6B7280" }]}>
                      <Text style={[styles.pendingChipText, { color: "#6B7280" }]}>IDEA</Text>
                    </View>
                  </View>

                  <Text style={[styles.pitchSummary, { color: colors.mutedForeground }]} numberOfLines={2}>{pitch.summary}</Text>

                  <View style={styles.pitchStats}>
                    <View style={styles.pitchStat}>
                      <Feather name="users" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.pitchStatText, { color: colors.mutedForeground }]}>{pitch.backersCount} backers</Text>
                    </View>
                    <View style={styles.pitchStat}>
                      <Text style={[styles.pitchStatText, { color: colors.mutedForeground }]}>{pitch.raised.toLocaleString()} π raised</Text>
                    </View>
                  </View>

                  <View style={styles.pitchActions}>
                    <Pressable onPress={() => router.push(`/pitch/${pitch.id}`)} style={({ pressed }) => [styles.docActionBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                      <Feather name="eye" size={13} color={colors.foreground} />
                      <Text style={[styles.docActionText, { color: colors.foreground }]}>Review</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => verifyPitch(pitch.id, pitch.title)}
                      disabled={processing === pitch.id}
                      style={({ pressed }) => [styles.docActionBtn, { backgroundColor: "#22C55E18", borderColor: "#22C55E", flex: 1.5, opacity: pressed || processing === pitch.id ? 0.7 : 1 }]}
                    >
                      {processing === pitch.id ? <ActivityIndicator size="small" color="#22C55E" /> : <><Feather name="check-circle" size={14} color="#22C55E" /><Text style={[styles.docActionText, { color: "#22C55E" }]}>Verify → IN_PROGRESS</Text></>}
                    </Pressable>
                  </View>
                </View>
              ))
            )
          )}

          {activeTab === "reputation" && (
            <>
              <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", paddingVertical: 28 }]}>
                <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: repTier.color + "18", borderWidth: 2, borderColor: repTier.color + "40" }}>
                  <Text style={{ fontSize: 32 }}>{repTier.emoji}</Text>
                </View>
                <Text style={{ fontSize: 52, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 12, lineHeight: 60 }}>
                  {repScore}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: repTier.color, marginBottom: 16 }}>{repTier.label}</Text>
                {repScore < 100 && (
                  <View style={{ width: "100%", paddingHorizontal: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                        Progress to {repTier.nextLabel}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                        {repScore} / {repTier.nextAt}
                      </Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}>
                      <View style={{ height: "100%", borderRadius: 4, backgroundColor: repTier.color, width: `${Math.min(100, Math.round((repScore / repTier.nextAt) * 100))}%` as any }} />
                    </View>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 10, marginTop: 6 }}>How Reputation is Earned</Text>
              <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" }]}>
                {REP_EVENTS.map((ev, i) => (
                  <View key={ev.type} style={{ flexDirection: "row", alignItems: "center", padding: 14, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: (ev.delta > 0 ? "#22C55E" : "#EF4444") + "15" }}>
                      <Text style={{ fontSize: 16 }}>{ev.emoji}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, marginLeft: 12 }}>{ev.label}</Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: (ev.delta > 0 ? "#22C55E" : "#EF4444") + "15" }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: ev.delta > 0 ? "#22C55E" : "#EF4444" }}>
                        {ev.delta > 0 ? "+" : ""}{ev.delta}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 10, marginTop: 18 }}>AI Dispute Resolution</Text>
              <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {DISPUTE_PHASES.map((phase, i) => (
                  <View key={phase.title} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: i < DISPUTE_PHASES.length - 1 ? 18 : 0 }}>
                    <View style={{ alignItems: "center", marginRight: 14, minWidth: 32 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "18" }}>
                        <Text style={{ fontSize: 16 }}>{phase.icon}</Text>
                      </View>
                      {i < DISPUTE_PHASES.length - 1 && (
                        <View style={{ width: 2, height: 14, backgroundColor: colors.border, marginTop: 4 }} />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingTop: 6 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{phase.title}</Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18, marginTop: 2 }}>{phase.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={[styles.docCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "30", flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 }]}>
                <Text style={{ fontSize: 22 }}>⚖️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>Jury Eligibility</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18, marginTop: 3 }}>
                    You need <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>10+ reputation</Text> and KYC-verified status to serve as a juror and earn rewards. Your score: <Text style={{ fontFamily: "Inter_700Bold", color: repScore >= 10 ? "#22C55E" : colors.foreground }}>{repScore}</Text>
                    {repScore >= 10 ? " ✅ Eligible" : ` (need ${10 - repScore} more)`}.
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyBox: { alignItems: "center", justifyContent: "center", padding: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  docCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, gap: 12 },
  docHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  docIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docType: { fontSize: 13, fontFamily: "Inter_700Bold" },
  docTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  pendingChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pendingChipText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  docUrl: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  docUrlText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  docProjectLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  docActions: { flexDirection: "row", gap: 8 },
  docActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10 },
  docActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pitchCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, gap: 12 },
  pitchHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  pitchIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pitchTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  pitchMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  pitchSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  pitchStats: { flexDirection: "row", gap: 14 },
  pitchStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  pitchStatText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  pitchActions: { flexDirection: "row", gap: 8 },
  validatorCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 12 },
  validatorCardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  validatorIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  validatorTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  validatorSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  validatorBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 12 },
  validatorBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  validatorRoleBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  validatorRoleText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
