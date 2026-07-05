import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type Recommendation = {
  id: string;
  title: string;
  industry: string;
  stage: string;
  city: string;
  raising: number;
  raised: number;
  backersCount: number;
  trending: boolean;
  trustScore: number | null;
  verificationStatus: string | null;
  summary: string;
  matchScore: number;
  matchReason: string;
};

type MatchmakerResponse = {
  profile: { backedProjectsCount: number; favoredIndustries: { industry: string; count: number }[]; avgCheckSize: number };
  recommendations: Recommendation[];
};

export function MatchmakerCarousel() {
  const colors = useColors();
  const { token } = useAuth();

  const { data, isLoading } = useQuery<MatchmakerResponse>({
    queryKey: ["/api/ai/matchmaker"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/ai/matchmaker`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={[styles.wrap, { alignItems: "center", paddingVertical: 24 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data || data.recommendations.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={[styles.orb, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="target" size={13} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>AI Matchmaker</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {data.profile.backedProjectsCount > 0
              ? "Personalized picks based on your investment history"
              : "Personalized picks to get you started"}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
      >
        {data.recommendations.map((rec) => (
          <Pressable
            key={rec.id}
            onPress={() => router.push(`/pitch/${rec.id}` as any)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.matchBadge, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="zap" size={10} color={colors.primary} />
                <Text style={[styles.matchBadgeText, { color: colors.primary }]}>{rec.matchScore}% match</Text>
              </View>
              {rec.trending && (
                <View style={styles.trendingBadge}>
                  <Feather name="trending-up" size={10} color="#F97316" />
                </View>
              )}
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{rec.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {rec.industry} · {rec.stage} · {rec.city}
            </Text>
            <Text style={[styles.cardReason, { color: colors.primary }]} numberOfLines={2}>{rec.matchReason}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.cardElevated }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${Math.min(100, Math.round((rec.raised / (rec.raising || 1)) * 100))}%` },
                ]}
              />
            </View>
            <Text style={[styles.cardFunding, { color: colors.mutedForeground }]}>
              {rec.raised.toLocaleString()} / {rec.raising.toLocaleString()} π
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  orb: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  card: { width: 220, borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  matchBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  matchBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  trendingBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#F9731618", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  cardMeta: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardReason: { fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 15, marginVertical: 4 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  progressFill: { height: "100%", borderRadius: 2 },
  cardFunding: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 4 },
});
