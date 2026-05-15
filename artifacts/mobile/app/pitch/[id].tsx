import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Pitch, User } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type PitchUpdate = {
  id: string;
  pitchId: string;
  authorId: string;
  content: string;
  createdAt: string;
};

type Supporter = {
  id: string;
  name: string;
  avatarKey: string | null;
  handle: string;
};

type PitchDetail = Pitch & {
  founder: (User & { following?: boolean }) | null;
  related: (Pitch & { verified?: boolean })[];
  supporters?: Supporter[];
  verified?: boolean;
  trustScore?: number;
  entityType?: string;
  serviceCategory?: string;
  verificationStatus?: string;
  roadmapUrl?: string | null;
  founderLinkedin?: string | null;
  proofOfRealityUrl?: string | null;
  portfolioUrl?: string | null;
  experienceDescription?: string | null;
};

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function pct(raised: number, raising: number) {
  if (!raising) return 0;
  return Math.min(100, Math.round((raised / raising) * 100));
}

const STAGE_COLOR: Record<string, string> = {
  "Pre-seed": "#F97316",
  Seed: "#EAB308",
  "Series A": "#22C55E",
  "Series B": "#3B82F6",
  "Series C": "#8B5CF6",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PitchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [backing, setBacking] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  const { data: pitch, isLoading } = useQuery<PitchDetail>({
    queryKey: [`/api/pitches/${id}`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pitches/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id && !!token,
    staleTime: 15_000,
  });

  const { data: updates } = useQuery<PitchUpdate[]>({
    queryKey: [`/api/pitches/${id}/updates`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pitches/${id}/updates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!token,
    staleTime: 30_000,
  });

  const handleBack = () => {
    if (!pitch || pitch.backed || backing) return;
    setShowDisclaimer(true);
  };

  const confirmBack = async () => {
    setShowDisclaimer(false);
    if (!pitch || pitch.backed || backing) return;
    setBacking(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/back`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 0 }),
      });
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/pitches"] });
    } finally {
      setBacking(false);
    }
  };

  const handleReport = async () => {
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reportReason }),
      });
      setReportSent(true);
    } catch {}
  };

  const handlePostUpdate = async () => {
    if (!newUpdate.trim()) return;
    setPostingUpdate(true);
    try {
      await fetch(`${API_BASE}/api/pitches/${id}/updates`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newUpdate }),
      });
      setNewUpdate("");
      qc.invalidateQueries({ queryKey: [`/api/pitches/${id}/updates`] });
    } finally {
      setPostingUpdate(false);
    }
  };

  const isServiceApp = pitch?.entityType === "service_app";
  const stageColor = pitch
    ? isServiceApp
      ? "#F97316"
      : (STAGE_COLOR[pitch.stage] ?? colors.primary)
    : colors.primary;
  const progress = pitch ? pct(pitch.raised, pitch.raising) : 0;
  const isVerified = pitch?.verified ?? false;
  const actionLabel = isServiceApp ? "Request Service" : "Express Interest";
  const actionedLabel = isServiceApp ? "Service Requested" : "Interest Expressed";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text
          style={[styles.topBarTitle, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {isServiceApp ? "Service Details" : "Project Details"}
        </Text>
        <Pressable
          onPress={() => setShowReportModal(true)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.reportBtn,
            { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="flag" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {isLoading || !pitch ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.hero, { backgroundColor: stageColor + "18", borderBottomColor: colors.border }]}
          >
            <View style={[styles.heroIcon, { backgroundColor: stageColor + "22" }]}>
              <Feather name={isServiceApp ? "tool" : "zap"} size={32} color={stageColor} />
            </View>
            <View style={styles.badges}>
              {!isServiceApp && <Badge label={pitch.stage} color={stageColor} />}
              <Badge
                label={isServiceApp ? (pitch.serviceCategory ?? "Service") : pitch.industry}
                color={colors.accent}
              />
              <Badge label={pitch.city} color={colors.mutedForeground} icon="map-pin" />
              {isVerified ? (
                <Badge label="Verified" color="#22C55E" icon="check-circle" />
              ) : (
                <Badge label="Unverified" color={colors.mutedForeground} icon="alert-circle" />
              )}
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.foreground, flex: 1 }]}>
                {pitch.title}
              </Text>
              {isVerified && (
                <Feather name="check-circle" size={20} color="#22C55E" style={{ marginLeft: 8, marginTop: 4 }} />
              )}
            </View>

            {pitch.trending && (
              <View style={[styles.trendingBadge, { backgroundColor: colors.sponsor + "20", borderColor: colors.sponsor }]}>
                <Feather name="trending-up" size={11} color={colors.sponsor} />
                <Text style={[styles.trendingText, { color: colors.sponsor }]}>
                  Trending
                </Text>
              </View>
            )}

            <Text style={[styles.summary, { color: colors.mutedForeground }]}>
              {pitch.summary}
            </Text>

            {!isServiceApp && (
              <View
                style={[
                  styles.fundingCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.fundingRow}>
                  <View>
                    <Text style={[styles.fundingAmount, { color: colors.foreground }]}>
                      {formatMoney(pitch.raised)}
                    </Text>
                    <Text style={[styles.fundingLabel, { color: colors.mutedForeground }]}>
                      raised of {formatMoney(pitch.raising)}
                    </Text>
                  </View>
                  <Text style={[styles.pctText, { color: stageColor }]}>
                    {progress}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` as any, backgroundColor: stageColor },
                    ]}
                  />
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
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 0 }]}>
                  Experience
                </Text>
                <Text style={[styles.summary, { color: colors.mutedForeground, marginBottom: 0 }]}>
                  {pitch.experienceDescription}
                </Text>
              </View>
            ) : null}

            <View style={styles.proofRow}>
              {pitch.proofOfRealityUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(pitch.proofOfRealityUrl!)}
                  style={({ pressed }) => [
                    styles.proofBtn,
                    { backgroundColor: "#22C55E" + "18", borderColor: "#22C55E", opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="play-circle" size={14} color="#22C55E" />
                  <Text style={[styles.proofBtnText, { color: "#22C55E" }]}>View Proof</Text>
                </Pressable>
              ) : null}
              {pitch.roadmapUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(pitch.roadmapUrl!)}
                  style={({ pressed }) => [
                    styles.proofBtn,
                    { backgroundColor: colors.primary + "18", borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="map" size={14} color={colors.primary} />
                  <Text style={[styles.proofBtnText, { color: colors.primary }]}>Roadmap</Text>
                </Pressable>
              ) : null}
              {pitch.portfolioUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(pitch.portfolioUrl!)}
                  style={({ pressed }) => [
                    styles.proofBtn,
                    { backgroundColor: colors.accent + "18", borderColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="briefcase" size={14} color={colors.accent} />
                  <Text style={[styles.proofBtnText, { color: colors.accent }]}>Portfolio</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={handleBack}
              disabled={pitch.backed || backing}
              style={({ pressed }) => [
                styles.investBtn,
                {
                  backgroundColor: pitch.backed ? colors.cardElevated : stageColor,
                  borderColor: pitch.backed ? colors.border : stageColor,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {backing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather
                    name={pitch.backed ? "check-circle" : isServiceApp ? "tool" : "trending-up"}
                    size={16}
                    color={pitch.backed ? colors.foreground : "#fff"}
                  />
                  <Text
                    style={[
                      styles.investBtnText,
                      { color: pitch.backed ? colors.foreground : "#fff" },
                    ]}
                  >
                    {pitch.backed ? actionedLabel : actionLabel}
                  </Text>
                </>
              )}
            </Pressable>

            {pitch.founder && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Founder
                </Text>
                <Pressable
                  onPress={() => router.push(`/profile/${pitch.founder!.id}`)}
                  style={({ pressed }) => [
                    styles.founderCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Avatar avatarKey={pitch.founder.avatarKey} size={52} ring />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={styles.founderNameRow}>
                      <Text style={[styles.founderName, { color: colors.foreground }]}>
                        {pitch.founder.name}
                      </Text>
                      {(pitch.founder as any).verified && (
                        <Feather name="check-circle" size={13} color={colors.primary} />
                      )}
                    </View>
                    <Text style={[styles.founderRole, { color: colors.mutedForeground }]}>
                      {(pitch.founder as any).title} · {(pitch.founder as any).company}
                    </Text>
                    <Text style={[styles.founderCity, { color: colors.mutedForeground }]}>
                      {(pitch.founder as any).city}
                    </Text>
                  </View>
                  {pitch.founderLinkedin ? (
                    <Pressable
                      onPress={() => Linking.openURL(pitch.founderLinkedin!)}
                      hitSlop={8}
                    >
                      <Feather name="linkedin" size={16} color={colors.primary} />
                    </Pressable>
                  ) : null}
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              </>
            )}

            {pitch.supporters && pitch.supporters.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Supporters ({pitch.supporters.length})
                </Text>
                <View style={[styles.supportersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {pitch.supporters.map((s) => (
                    <View key={s.id} style={styles.supporterRow}>
                      <Avatar avatarKey={s.avatarKey} size={32} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.supporterName, { color: colors.foreground }]}>
                          {s.name}
                        </Text>
                        <Text style={[styles.supporterHandle, { color: colors.mutedForeground }]}>
                          @{s.handle}
                        </Text>
                      </View>
                      <Feather name="heart" size={13} color="#EF4444" />
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Latest Updates
            </Text>
            <View style={[styles.updatesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.updateComposer, { borderBottomColor: colors.border }]}>
                <TextInput
                  value={newUpdate}
                  onChangeText={setNewUpdate}
                  placeholder="Post an update (founders only)…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.updateInput, { color: colors.foreground, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                  multiline
                />
                <Pressable
                  onPress={handlePostUpdate}
                  disabled={postingUpdate || !newUpdate.trim()}
                  style={({ pressed }) => [
                    styles.updatePostBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed || !newUpdate.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  {postingUpdate ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="send" size={13} color="#fff" />
                  )}
                </Pressable>
              </View>
              {!updates || updates.length === 0 ? (
                <View style={styles.updatesEmpty}>
                  <Text style={[styles.updatesEmptyText, { color: colors.mutedForeground }]}>
                    No updates yet
                  </Text>
                </View>
              ) : (
                updates.map((u) => (
                  <View key={u.id} style={[styles.updateItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.updateItemHeader}>
                      <Feather name="bell" size={12} color={colors.primary} />
                      <Text style={[styles.updateItemTime, { color: colors.mutedForeground }]}>
                        {timeAgo(u.createdAt)}
                      </Text>
                    </View>
                    <Text style={[styles.updateItemContent, { color: colors.foreground }]}>
                      {u.content}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {pitch.related && pitch.related.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Similar in {pitch.industry}
                </Text>
                {pitch.related.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push(`/pitch/${r.id}`)}
                    style={({ pressed }) => [
                      styles.relatedCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.relatedIcon, { backgroundColor: (STAGE_COLOR[r.stage] ?? colors.primary) + "20" }]}>
                      <Feather name="zap" size={14} color={STAGE_COLOR[r.stage] ?? colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={[styles.relatedTitle, { color: colors.foreground }]}>
                          {r.title}
                        </Text>
                        {r.verified && (
                          <Feather name="check-circle" size={11} color="#22C55E" />
                        )}
                      </View>
                      <Text style={[styles.relatedMeta, { color: colors.mutedForeground }]}>
                        {r.stage} · {formatMoney(r.raised)} raised
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showDisclaimer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisclaimer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#F97316" + "20" }]}>
              <Feather name="alert-triangle" size={28} color="#F97316" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Important Notice
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Please review the project's Roadmap and Proof of Reality before proceeding.{"\n\n"}
              HumanVerse is a platform for connection — due diligence is your responsibility.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowDisclaimer(false)}
                style={({ pressed }) => [
                  styles.modalCancel,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmBack}
                style={({ pressed }) => [
                  styles.modalConfirm,
                  { backgroundColor: stageColor, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalConfirmText}>I Understand, Proceed</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowReportModal(false); setReportSent(false); setReportReason(""); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#EF4444" + "20" }]}>
              <Feather name="flag" size={24} color="#EF4444" />
            </View>
            {reportSent ? (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Sent</Text>
                <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
                  Thank you. Our team will review this report.
                </Text>
                <Pressable
                  onPress={() => { setShowReportModal(false); setReportSent(false); setReportReason(""); }}
                  style={({ pressed }) => [
                    styles.modalConfirm,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, alignSelf: "center" },
                  ]}
                >
                  <Text style={styles.modalConfirmText}>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report this Profile</Text>
                <TextInput
                  value={reportReason}
                  onChangeText={setReportReason}
                  placeholder="Describe the issue (optional)…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.reportInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background,
                      ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
                  ]}
                  multiline
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => { setShowReportModal(false); setReportReason(""); }}
                    style={({ pressed }) => [
                      styles.modalCancel,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleReport}
                    style={({ pressed }) => [
                      styles.modalConfirm,
                      { backgroundColor: "#EF4444", opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={styles.modalConfirmText}>Submit Report</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Badge({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon?: keyof typeof Feather.glyphMap;
}) {
  return (
    <View style={[badgeStyles.pill, { backgroundColor: color + "22", borderColor: color + "66" }]}>
      {icon && <Feather name={icon} size={10} color={color} />}
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

function MiniStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={miniStatStyles.wrap}>
      <Text style={[miniStatStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[miniStatStyles.value, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const miniStatStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  label: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  value: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    borderBottomWidth: 1,
    gap: 16,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  body: {
    padding: 20,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  trendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  trendingText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  summary: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  fundingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  fundingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  fundingAmount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  fundingLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  pctText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
  },
  proofRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  proofBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  proofBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  investBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  investBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
    marginTop: 16,
    marginBottom: 10,
  },
  founderCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  founderNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  founderName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  founderRole: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  founderCity: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  supportersCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 8,
  },
  supporterRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 4,
  },
  supporterName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  supporterHandle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  updatesCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  updateComposer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  updateInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minHeight: 36,
  },
  updatePostBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  updatesEmpty: {
    padding: 16,
    alignItems: "center",
  },
  updatesEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  updateItem: {
    padding: 14,
    borderBottomWidth: 1,
  },
  updateItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  updateItemTime: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  updateItemContent: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  relatedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  relatedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  relatedTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  relatedMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    width: "100%",
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  reportInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    marginTop: 4,
  },
});
