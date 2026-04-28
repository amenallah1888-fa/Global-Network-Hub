import { Feather } from "@expo/vector-icons";
import { useListCircles } from "@workspace/api-client-react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CircleCard } from "@/components/CircleCard";
import { Header } from "@/components/Header";
import { SegmentControl } from "@/components/SegmentControl";
import { useColors } from "@/hooks/useColors";

const SEGMENTS = ["Discover", "Joined", "Paid"];

export default function CirclesScreen() {
  const colors = useColors();
  const [segment, setSegment] = useState("Discover");
  const { data: circles, isLoading } = useListCircles();

  const list = circles ?? [];
  const visible = useMemo(() => {
    if (segment === "Joined") return list.filter((c) => c.joined);
    if (segment === "Paid") return list.filter((c) => c.paid);
    return list;
  }, [list, segment]);

  const totalActive = list.reduce(
    (sum, c) => sum + (c.joined ? c.activeNow : 0),
    0,
  );
  const monthly = list
    .filter((c) => c.joined && c.paid)
    .reduce((s, c) => s + (c.price ?? 0), 0);
  const memberships = list.filter((c) => c.joined).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Circles"
        subtitle="Your private rooms & paid groups"
        rightIcon="plus"
      />
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CircleCard circle={item} />}
        ListHeaderComponent={
          <View>
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[styles.ctaIcon, { backgroundColor: colors.primary + "1F" }]}
              >
                <Feather name="users" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
                  Start a Circle
                </Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
                  Invite-only or paid. You set the bar.
                </Text>
              </View>
              <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
            </Pressable>

            <View style={styles.statsRow}>
              <View
                style={[
                  styles.stat,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {memberships}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Memberships
                </Text>
              </View>
              <View
                style={[
                  styles.stat,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {totalActive}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Active now
                </Text>
              </View>
              <View
                style={[
                  styles.stat,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.tip }]}>
                  ${monthly}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Monthly
                </Text>
              </View>
            </View>

            <View style={{ paddingVertical: 6 }}>
              <SegmentControl
                options={SEGMENTS}
                value={segment}
                onChange={setSegment}
              />
            </View>
            <View style={{ height: 12 }} />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="users" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No circles here yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {segment === "Joined"
                  ? "Join one from Discover to see it here."
                  : segment === "Paid"
                    ? "Premium circles will appear here."
                    : "New rooms open every week."}
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cta: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  ctaSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
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
