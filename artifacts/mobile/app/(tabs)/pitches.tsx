import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/Header";
import { PitchCard } from "@/components/PitchCard";
import { SegmentControl } from "@/components/SegmentControl";
import { pitches } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const STAGES = ["All", "Pre-seed", "Seed", "Series A", "Series B"];

export default function PitchesScreen() {
  const colors = useColors();
  const [stage, setStage] = useState("All");

  const visible = useMemo(() => {
    if (stage === "All") return pitches;
    return pitches.filter((p) => p.stage === stage);
  }, [stage]);

  const totalRaising = pitches.reduce((s, p) => s + p.raising - p.raised, 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Investment Hub"
        subtitle="Curated deal flow"
        rightIcon="filter"
      />
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PitchCard pitch={item} />}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.hero,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View>
                <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>
                  OPEN ALLOCATION
                </Text>
                <Text style={[styles.heroValue, { color: colors.foreground }]}>
                  ${(totalRaising / 1_000_000).toFixed(1)}M
                </Text>
                <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
                  across {pitches.length} live rounds
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.heroBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="plus" size={14} color={colors.primaryForeground} />
                <Text
                  style={[styles.heroBtnText, { color: colors.primaryForeground }]}
                >
                  Pitch
                </Text>
              </Pressable>
            </View>

            <View style={{ paddingVertical: 12 }}>
              <SegmentControl
                options={STAGES}
                value={stage}
                onChange={setStage}
                scrollable
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="briefcase" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No live rounds at this stage
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Adjust the filter or check back tomorrow.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  heroValue: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    marginTop: 6,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  heroBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
