import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

type Milestone = { id: string; pitchId: string; title: string; description: string; percentageOfFunds: number; status: string; proofUrl: string | null; completedAt: string | null; order: number };
type Pitch = { id: string; title: string; summary: string; raised: number; raising: number; backersCount: number; stage: string; industry: string; city: string; verified: boolean; trustScore: number };

function pct(raised: number, raising: number) { return !raising ? 0 : Math.min(100, Math.round((raised / raising) * 100)); }
function timeAgo(dateStr: string) { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return `${Math.floor(hrs / 24)}d ago`; }

const STATUS_COLOR: Record<string, string> = { locked: "#6B7280", pending_proof: "#F59E0B", released: "#22C55E" };
const STATUS_LABEL: Record<string, string> = { locked: "Locked", pending_proof: "Proof Submitted — Awaiting Verification", released: "Funds Released" };

function MilestoneCard({ milestone, pitchId, token, onRefresh }: { milestone: Milestone; pitchId: string; token: string | null; onRefresh: () => void }) {
  const colors = useColors();
  const [proofUrl, setProofUrl] = useState(milestone.proofUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const mColor = STATUS_COLOR[milestone.status] ?? "#6B7280";
  const mLabel = STATUS_LABEL[milestone.status] ?? milestone.status;

  const handleSubmit = async () => {
    if (!proofUrl.trim()) { Alert.alert("Required", "Enter a URL for your proof of work"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/milestones/${milestone.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_proof", proofUrl: proofUrl.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      onRefresh();
      Alert.alert("Submitted!", "Your proof of work has been submitted for backer review.");
    } catch { Alert.alert("Error", "Could not submit proof"); } finally { setSubmitting(false); }
  };

  return (
    <View style={[ms.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={ms.header}>
        <View style={[ms.dot, { backgroundColor: mColor + "22", borderColor: mColor }]}>
          <Feather name={milestone.status === "released" ? "check" : milestone.status === "pending_proof" ? "clock" : "lock"} size={12} color={mColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ms.title, { color: colors.foreground }]}>{milestone.title}</Text>
          <Text style={[ms.pct, { color: mColor }]}>{milestone.percentageOfFunds}% of total funds</Text>
        </View>
        <View style={[ms.chip, { backgroundColor: mColor + "18", borderColor: mColor }]}>
          <Text style={[ms.chipText, { color: mColor }]}>{milestone.status === "released" ? "Released" : milestone.status === "pending_proof" ? "Pending" : "Locked"}</Text>
        </View>
      </View>

      {!!milestone.description && <Text style={[ms.desc, { color: colors.mutedForeground }]}>{milestone.description}</Text>}

      {milestone.status === "released" && milestone.completedAt && (
        <View style={[ms.successRow, { backgroundColor: "#22C55E10" }]}>
          <Feather name="check-circle" size={13} color="#22C55E" />
          <Text style={ms.successText}>Funds released {timeAgo(milestone.completedAt)}</Text>
        </View>
      )}

      {milestone.status === "pending_proof" && milestone.proofUrl && (
        <Pressable onPress={() => Linking.openURL(milestone.proofUrl!)} style={({ pressed }) => [ms.proofLink, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="external-link" size={12} color="#F59E0B" />
          <Text style={{ fontSize: 12, color: "#F59E0B", fontFamily: "Inter_500Medium" }}>View submitted proof</Text>
        </Pressable>
      )}

      {milestone.status === "locked" && (
        <View style={ms.proofSection}>
          <Text style={[ms.proofLabel, { color: colors.mutedForeground }]}>Submit Proof of Work</Text>
          <TextInput
            value={proofUrl}
            onChangeText={setProofUrl}
            placeholder="GitHub link, video, portfolio, doc…"
            placeholderTextColor={colors.mutedForeground}
            style={[ms.proofInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
          />
          <Pressable onPress={handleSubmit} disabled={submitting} style={({ pressed }) => [ms.submitBtn, { backgroundColor: "#F59E0B", opacity: pressed || submitting ? 0.7 : 1 }]}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="upload" size={14} color="#fff" /><Text style={ms.submitBtnText}>Submit Proof</Text></>}
          </Pressable>
        </View>
      )}

      <Text style={[ms.statusFull, { color: colors.mutedForeground }]}>{mLabel}</Text>
    </View>
  );
}

function CampaignCard({ pitch, token }: { pitch: Pitch; token: string | null }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const progress = pct(pitch.raised, pitch.raising);

  const { data: milestones, refetch } = useQuery<Milestone[]>({
    queryKey: [`/api/pitches/${pitch.id}/milestones`],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches/${pitch.id}/milestones`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) return []; return res.json(); },
    enabled: !!token,
    staleTime: 20_000,
  });

  const releasedCount = (milestones ?? []).filter(m => m.status === "released").length;
  const totalCount = (milestones ?? []).length;

  return (
    <View style={[cc.card, { backgroundColor: colors.card, borderColor: pitch.verified ? "#22C55E" : colors.border, borderWidth: pitch.verified ? 1.5 : 1 }]}>
      <Pressable onPress={() => setExpanded(v => !v)}>
        <View style={cc.header}>
          <View style={{ flex: 1 }}>
            <View style={cc.titleRow}>
              <Text style={[cc.title, { color: colors.foreground }]}>{pitch.title}</Text>
              {pitch.verified && <Feather name="check-circle" size={14} color="#22C55E" />}
            </View>
            <Text style={[cc.meta, { color: colors.mutedForeground }]}>{pitch.stage} · {pitch.industry} · {pitch.city}</Text>
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={cc.statsRow}>
            <Text style={[cc.statVal, { color: colors.foreground }]}>{pitch.raised.toLocaleString()} π</Text>
            <Text style={[cc.statSep, { color: colors.mutedForeground }]}>raised</Text>
            <Text style={[cc.statVal, { color: colors.mutedForeground }]}>of {pitch.raising.toLocaleString()} π</Text>
            <View style={{ flex: 1 }} />
            <Text style={[cc.backersText, { color: colors.mutedForeground }]}>{pitch.backersCount} backers</Text>
          </View>
          <View style={[cc.track, { backgroundColor: colors.border }]}>
            <View style={[cc.fill, { width: `${progress}%` as any, backgroundColor: "#22C55E" }]} />
          </View>
          {totalCount > 0 && (
            <Text style={[cc.milestoneProgress, { color: colors.mutedForeground }]}>
              Milestones: {releasedCount}/{totalCount} released
            </Text>
          )}
        </View>
      </Pressable>

      <View style={cc.actions}>
        <Pressable onPress={() => router.push(`/pitch/${pitch.id}`)} style={({ pressed }) => [cc.actionBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="external-link" size={13} color={colors.foreground} />
          <Text style={[cc.actionText, { color: colors.foreground }]}>View Project</Text>
        </Pressable>
      </View>

      {expanded && (
        <View style={[cc.milestones, { borderTopColor: colors.border }]}>
          <Text style={[cc.milestonesTitle, { color: colors.foreground }]}>Milestone Roadmap</Text>
          {!milestones ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : milestones.length === 0 ? (
            <Text style={[cc.emptyText, { color: colors.mutedForeground }]}>No milestones yet. They appear after a backer creates an escrow agreement.</Text>
          ) : (
            milestones.map(m => <MilestoneCard key={m.id} milestone={m} pitchId={pitch.id} token={token} onRefresh={refetch} />)
          )}
        </View>
      )}
    </View>
  );
}

export default function MyCampaignsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const { data: allPitches, isLoading } = useQuery<Pitch[]>({
    queryKey: ["/api/pitches"],
    queryFn: async () => { const res = await fetch(`${API_BASE}/api/pitches`, { headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) return []; return res.json(); },
    enabled: !!token,
    staleTime: 20_000,
  });

  const myPitches = (allPitches ?? []).filter((p: any) => p.founderId === user?.id);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Active Campaigns</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Track milestones and submit proof</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : myPitches.length === 0 ? (
          <View style={styles.center}>
            <Feather name="briefcase" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Campaigns Yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Create a project in the Hub to start raising funds through milestone-based escrow.</Text>
            <Pressable onPress={() => router.push("/(tabs)/pitches")} style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.ctaBtnText}>Create a Project</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.summaryBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.foreground }]}>{myPitches.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Projects</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.foreground }]}>{myPitches.reduce((s, p) => s + p.backersCount, 0)}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Backers</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: "#22C55E" }]}>{myPitches.reduce((s, p) => s + p.raised, 0).toLocaleString()} π</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Raised</Text>
              </View>
            </View>

            {myPitches.map(p => <CampaignCard key={p.id} pitch={p} token={token} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const ms = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pct: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 8 },
  successText: { fontSize: 12, color: "#22C55E", fontFamily: "Inter_500Medium" },
  proofLink: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 8, borderWidth: 1 },
  proofSection: { gap: 8 },
  proofLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  proofInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: "Inter_400Regular" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  submitBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusFull: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
});

const cc = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statSep: { fontSize: 12, fontFamily: "Inter_400Regular" },
  backersText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  milestoneProgress: { fontSize: 11, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  milestones: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  milestonesTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 10 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  content: { padding: 16, gap: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  ctaBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  summaryBanner: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, marginHorizontal: 8 },
  summaryVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
});
