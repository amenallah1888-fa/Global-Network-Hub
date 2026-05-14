import { Feather } from "@expo/vector-icons";
import { useListPitches } from "@workspace/api-client-react";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  city: string | null;
  onClose: () => void;
};

function strengthScore(raised: number, raising: number, backers: number): number {
  const pct = raising > 0 ? raised / raising : 0;
  return raised + backers * 5_000 + pct * 100_000;
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const STAGE_COLOR: Record<string, string> = {
  "Pre-seed": "#F97316",
  Seed: "#EAB308",
  "Series A": "#22C55E",
  "Series B": "#3B82F6",
  "Series C": "#8B5CF6",
};

export function RegionProjectsSheet({ city, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: allPitches } = useListPitches();

  const ranked = useMemo(() => {
    if (!city || !allPitches) return [];
    return allPitches
      .filter((p) => p.city.toLowerCase() === city.toLowerCase())
      .sort(
        (a, b) =>
          strengthScore(b.raised, b.raising, b.backersCount) -
          strengthScore(a.raised, a.raising, a.backersCount),
      );
  }, [allPitches, city]);

  const totalRaised = useMemo(
    () => ranked.reduce((s, p) => s + p.raised, 0),
    [ranked],
  );

  return (
    <Modal
      visible={city !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 28),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Feather name="map-pin" size={15} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              {city}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <SummaryPill
            icon="zap"
            label={`${ranked.length} projects`}
            colors={colors}
          />
          <SummaryPill
            icon="trending-up"
            label={`${formatMoney(totalRaised)} raised`}
            colors={colors}
          />
        </View>

        {ranked.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No projects listed for {city} yet
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {ranked.map((pitch, i) => {
              const score = strengthScore(pitch.raised, pitch.raising, pitch.backersCount);
              const pct = pitch.raising > 0
                ? Math.min(100, Math.round((pitch.raised / pitch.raising) * 100))
                : 0;
              const stageColor = STAGE_COLOR[pitch.stage] ?? colors.primary;

              return (
                <Pressable
                  key={pitch.id}
                  onPress={() => {
                    onClose();
                    router.push(`/pitch/${pitch.id}`);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.cardElevated,
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.rank, { color: colors.mutedForeground }]}>
                    #{i + 1}
                  </Text>

                  <View style={[styles.rowIcon, { backgroundColor: stageColor + "22" }]}>
                    <Feather name="zap" size={14} color={stageColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <Text
                        style={[styles.rowTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {pitch.title}
                      </Text>
                      {pitch.trending && (
                        <Feather name="trending-up" size={12} color={colors.sponsor} />
                      )}
                    </View>
                    <Text
                      style={[styles.rowMeta, { color: colors.mutedForeground }]}
                    >
                      {pitch.stage} · {pitch.industry}
                    </Text>
                    <View style={styles.progressWrap}>
                      <View
                        style={[styles.progressTrack, { backgroundColor: colors.border }]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${pct}%` as any, backgroundColor: stageColor },
                          ]}
                        />
                      </View>
                      <Text
                        style={[styles.progressText, { color: colors.mutedForeground }]}
                      >
                        {formatMoney(pitch.raised)} · {pct}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scoreWrap}>
                    <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>
                      Strength
                    </Text>
                    <Text style={[styles.scoreValue, { color: stageColor }]}>
                      {score >= 1_000_000
                        ? `${(score / 1_000_000).toFixed(1)}M`
                        : score >= 1_000
                          ? `${(score / 1_000).toFixed(0)}K`
                          : score.toFixed(0)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function SummaryPill({
  icon,
  label,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        pillStyles.pill,
        { backgroundColor: colors.cardElevated, borderColor: colors.border },
      ]}
    >
      <Feather name={icon} size={12} color={colors.mutedForeground} />
      <Text style={[pillStyles.label, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}
const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 22,
    paddingTop: 14,
    maxHeight: "70%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  list: { flex: 1 },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  rank: {
    width: 28,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  rowMeta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  scoreWrap: { alignItems: "center" },
  scoreLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  scoreValue: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginTop: 2 },
});
