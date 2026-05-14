import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Pitch, User } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type PitchDetail = Pitch & {
  founder: (User & { following?: boolean }) | null;
  related: Pitch[];
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

export default function PitchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [backing, setBacking] = useState(false);

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

  const handleBack = async () => {
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

  const stageColor = pitch ? (STAGE_COLOR[pitch.stage] ?? colors.primary) : colors.primary;
  const progress = pitch ? pct(pitch.raised, pitch.raising) : 0;

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
          Project Details
        </Text>
        <View style={{ width: 36 }} />
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
              <Feather name="zap" size={32} color={stageColor} />
            </View>
            <View style={styles.badges}>
              <Badge label={pitch.stage} color={stageColor} />
              <Badge label={pitch.industry} color={colors.accent} />
              <Badge label={pitch.city} color={colors.mutedForeground} icon="map-pin" />
            </View>
          </View>

          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {pitch.title}
            </Text>
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
                    name={pitch.backed ? "check-circle" : "trending-up"}
                    size={16}
                    color={pitch.backed ? colors.foreground : "#fff"}
                  />
                  <Text
                    style={[
                      styles.investBtnText,
                      { color: pitch.backed ? colors.foreground : "#fff" },
                    ]}
                  >
                    {pitch.backed ? "Interest Expressed" : "Express Interest"}
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
                      {pitch.founder.verified && (
                        <Feather name="check-circle" size={13} color={colors.primary} />
                      )}
                    </View>
                    <Text style={[styles.founderRole, { color: colors.mutedForeground }]}>
                      {pitch.founder.title} · {pitch.founder.company}
                    </Text>
                    <Text style={[styles.founderCity, { color: colors.mutedForeground }]}>
                      {pitch.founder.city}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              </>
            )}

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
                      <Text style={[styles.relatedTitle, { color: colors.foreground }]}>
                        {r.title}
                      </Text>
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
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 6,
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
});
