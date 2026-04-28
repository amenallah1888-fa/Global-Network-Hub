import { Feather } from "@expo/vector-icons";
import { useListMarkers, type Marker } from "@workspace/api-client-react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/Header";
import { MarkerDetailSheet } from "@/components/MarkerDetailSheet";
import { AtlasMap } from "@/components/MapView";
import { useColors } from "@/hooks/useColors";

const FILTERS: {
  key: Marker["type"] | "all";
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: "all", label: "All", icon: "globe" },
  { key: "person", label: "People", icon: "user" },
  { key: "business", label: "Businesses", icon: "briefcase" },
  { key: "project", label: "Projects", icon: "zap" },
];

const TRENDING_REGIONS = [
  { city: "San Francisco", count: 2148, growth: "+12%" },
  { city: "Berlin", count: 1402, growth: "+8%" },
  { city: "Bengaluru", count: 1188, growth: "+24%" },
  { city: "Tokyo", count: 920, growth: "+5%" },
  { city: "Lagos", count: 612, growth: "+31%" },
];

export default function MapScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<Marker["type"] | "all">("all");
  const [selected, setSelected] = useState<Marker | null>(null);

  const { data: markers } = useListMarkers();

  const stats = useMemo(() => {
    const visible = (markers ?? []).filter(
      (m) => filter === "all" || m.type === filter,
    );
    return {
      visible: visible.length,
      cities: new Set(visible.map((v) => v.city)).size,
    };
  }, [markers, filter]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Atlas"
        subtitle="Discover the active world"
        rightIcon="search"
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <Stat
            label="Active now"
            value={stats.visible.toString()}
            color={colors.primary}
            icon="activity"
          />
          <Stat
            label="Cities"
            value={stats.cities.toString()}
            color={colors.accent}
            icon="map-pin"
          />
          <Stat
            label="Live signals"
            value="184"
            color={colors.success}
            icon="radio"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name={f.icon}
                  size={13}
                  color={active ? colors.primaryForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <AtlasMap filter={filter} selected={selected} onSelect={setSelected} />

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Tap any marker to view full profile
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Trending regions
          </Text>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>
            See all
          </Text>
        </View>

        <View style={styles.regionList}>
          {TRENDING_REGIONS.map((r, i) => (
            <View
              key={r.city}
              style={[
                styles.region,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.rank, { color: colors.mutedForeground }]}>
                0{i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.regionCity, { color: colors.foreground }]}>
                  {r.city}
                </Text>
                <Text
                  style={[styles.regionMeta, { color: colors.mutedForeground }]}
                >
                  {r.count.toLocaleString()} active members
                </Text>
              </View>
              <View
                style={[
                  styles.growth,
                  {
                    backgroundColor: colors.success + "1F",
                    borderColor: colors.success,
                  },
                ]}
              >
                <Feather name="trending-up" size={11} color={colors.success} />
                <Text style={[styles.growthText, { color: colors.success }]}>
                  {r.growth}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <MarkerDetailSheet
        visible={selected != null}
        marker={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "1F" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 10,
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  regionList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  region: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rank: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    width: 24,
  },
  regionCity: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  regionMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  growth: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  growthText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
});
