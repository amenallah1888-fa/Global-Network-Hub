import { Feather } from "@expo/vector-icons";
import {
  getListCirclesQueryKey,
  useToggleCircleMembership,
} from "@workspace/api-client-react";
import type { Circle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { getImage } from "@/lib/imageMap";
import { useUsers } from "@/lib/userCache";

export function CircleCard({ circle }: { circle: Circle }) {
  const colors = useColors();
  const users = useUsers();
  const queryClient = useQueryClient();
  const toggle = useToggleCircleMembership();
  const founders = circle.founderIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as { id: string; avatarKey: string }[];
  const cover = getImage(circle.coverKey);

  const onToggle = () => {
    toggle.mutate(
      { id: circle.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          queryClient.invalidateQueries();
        },
      },
    );
  };

  const openDashboard = () => {
    router.push(`/circle/${circle.id}`);
  };

  return (
    <Pressable
      onPress={circle.joined ? openDashboard : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed && circle.joined ? 0.92 : 1 },
      ]}
    >
      <View style={styles.coverWrap}>
        {cover ? (
          <Image source={cover} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: circle.color + "30" }]} />
        )}
        <View style={[styles.coverFade, { backgroundColor: colors.card }]} />
        <View style={[styles.categoryPill, { backgroundColor: circle.color, borderColor: colors.card }]}>
          <Text style={styles.categoryText}>{circle.category}</Text>
        </View>
        {circle.paid ? (
          <View style={[styles.paidPill, { backgroundColor: colors.background + "EE" }]}>
            <Feather name="lock" size={10} color={colors.tip} />
            <Text style={[styles.paidText, { color: colors.tip }]}>${circle.price}/mo</Text>
          </View>
        ) : null}
        {circle.joined && (
          <View style={[styles.joinedIndicator, { backgroundColor: "#22C55E" }]}>
            <Feather name="check" size={10} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{circle.name}</Text>
        <Text style={[styles.about, { color: colors.mutedForeground }]} numberOfLines={2}>{circle.about}</Text>

        <View style={styles.footer}>
          <View style={styles.foundersRow}>
            {founders.slice(0, 3).map((f, i) => (
              <View key={f.id} style={[styles.avatarStack, { marginLeft: i === 0 ? 0 : -10, borderColor: colors.card }]}>
                <Avatar avatarKey={f.avatarKey} size={22} />
              </View>
            ))}
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.metaTop, { color: colors.foreground }]}>{circle.membersCount.toLocaleString()}</Text>
              <Text style={[styles.metaBottom, { color: colors.mutedForeground }]}>{circle.activeNow} active now</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {circle.joined && (
              <Pressable
                onPress={openDashboard}
                style={({ pressed }) => [styles.dashBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="grid" size={12} color={colors.primary} />
                <Text style={[styles.dashBtnText, { color: colors.primary }]}>Open</Text>
              </Pressable>
            )}
            <Pressable
              disabled={toggle.isPending}
              onPress={onToggle}
              style={({ pressed }) => [
                styles.joinBtn,
                {
                  backgroundColor: circle.joined ? colors.cardElevated : colors.primary,
                  borderColor: circle.joined ? colors.border : colors.primary,
                  opacity: pressed || toggle.isPending ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.joinText, { color: circle.joined ? colors.foreground : colors.primaryForeground }]}>
                {circle.joined ? "Joined" : circle.paid ? `Apply · $${circle.price}` : "Join"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, overflow: "hidden", marginHorizontal: 16, marginBottom: 14 },
  coverWrap: { height: 110, position: "relative" },
  cover: { width: "100%", height: "100%" },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 30, opacity: 0.5 },
  categoryPill: { position: "absolute", top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 2 },
  categoryText: { color: "#0A0B0F", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6, textTransform: "uppercase" },
  paidPill: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  paidText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  joinedIndicator: { position: "absolute", bottom: 12, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, paddingTop: 12 },
  name: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  about: { marginTop: 4, fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  footer: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  foundersRow: { flexDirection: "row", alignItems: "center" },
  avatarStack: { borderWidth: 2, borderRadius: 999 },
  metaTop: { fontSize: 13, fontFamily: "Inter_700Bold" },
  metaBottom: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  dashBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  dashBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  joinBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  joinText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
