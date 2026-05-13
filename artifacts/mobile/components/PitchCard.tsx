import { Feather } from "@expo/vector-icons";
import {
  getListPitchesQueryKey,
  useBackPitch,
} from "@workspace/api-client-react";
import type { Pitch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { getImage } from "@/lib/imageMap";
import { useCurrentUserId, useUserById } from "@/lib/userCache";

function formatMoney(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n;
}

export function PitchCard({ pitch }: { pitch: Pitch }) {
  const colors = useColors();
  const currentUserId = useCurrentUserId();
  const founder = useUserById(pitch.founderId);
  const queryClient = useQueryClient();
  const back = useBackPitch();
  const pct = Math.min(100, Math.round((pitch.raised / pitch.raising) * 100));
  const cover = getImage(pitch.coverKey);

  const onBack = () => {
    if (pitch.backed) return;
    back.mutate(
      { id: pitch.id, data: { amount: 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListPitchesQueryKey(),
          });
        },
      },
    );
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Avatar avatarKey={founder.avatarKey} size={36} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text
              style={[styles.founder, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {founder.name}
            </Text>
            <Text
              style={[styles.location, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {founder.title} · {pitch.city}
            </Text>
          </View>
        </View>
        {pitch.trending ? (
          <View
            style={[
              styles.trending,
              {
                backgroundColor: colors.primary + "1F",
                borderColor: colors.primary,
              },
            ]}
          >
            <Feather name="trending-up" size={11} color={colors.primary} />
            <Text style={[styles.trendingText, { color: colors.primary }]}>
              Trending
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>
        {pitch.title}
      </Text>
      <Text
        style={[styles.summary, { color: colors.mutedForeground }]}
        numberOfLines={3}
      >
        {pitch.summary}
      </Text>

      {cover ? (
        <Image source={cover} style={styles.cover} resizeMode="cover" />
      ) : null}

      <View style={styles.tagsRow}>
        <Tag label={pitch.stage} colors={colors} accent={colors.accent} />
        <Tag label={pitch.industry} colors={colors} />
        <Tag label={`${pitch.backersCount} backers`} colors={colors} />
      </View>

      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.amountRow}>
            <Text style={[styles.raised, { color: colors.foreground }]}>
              {formatMoney(pitch.raised)}
            </Text>
            <Text style={[styles.raising, { color: colors.mutedForeground }]}>
              of {formatMoney(pitch.raising)}
            </Text>
          </View>
          <View style={[styles.bar, { backgroundColor: colors.cardElevated }]}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor:
                    pct >= 100 ? colors.success : colors.primary,
                  width: `${pct}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.pct, { color: colors.mutedForeground }]}>
            {pct}% committed
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {pitch.founderId !== currentUserId ? (
          <Pressable
            onPress={() => router.push(`/chat/${pitch.founderId}`)}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name="message-circle"
              size={14}
              color={colors.foreground}
            />
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>
              Contact
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="eye" size={14} color={colors.foreground} />
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>
              Memo
            </Text>
          </Pressable>
        )}
        <Pressable
          disabled={back.isPending || pitch.backed}
          onPress={onBack}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: pitch.backed ? colors.success : colors.primary,
              opacity: pressed || back.isPending ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name={pitch.backed ? "check" : "briefcase"}
            size={14}
            color={colors.primaryForeground}
          />
          <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
            {pitch.backed ? "Interested" : "Express interest"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Tag({
  label,
  colors,
  accent,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  accent?: string;
}) {
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: accent ? accent + "20" : colors.cardElevated,
          borderColor: accent ?? colors.border,
        },
      ]}
    >
      <Text
        style={[styles.tagText, { color: accent ?? colors.mutedForeground }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  founder: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  location: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  trending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  trendingText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    marginTop: 14,
    lineHeight: 24,
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  cover: {
    width: "100%",
    height: 130,
    borderRadius: 14,
    marginTop: 12,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  progressRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 8,
  },
  raised: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  raising: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  bar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  pct: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
