import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { TipSheet } from "@/components/TipSheet";
import { useApp } from "@/context/AppContext";
import { Post, getUser } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function PostCard({ post }: { post: Post }) {
  const colors = useColors();
  const { toggleLike, toggleRetweet, tip } = useApp();
  const author = getUser(post.authorId);
  const [tipOpen, setTipOpen] = useState(false);

  const onLike = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleLike(post.id);
  };
  const onRetweet = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    toggleRetweet(post.id);
  };
  const onTip = (amount: number) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    tip(post.id, amount);
    setTipOpen(false);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: post.sponsored ? colors.sponsor : colors.border,
        },
      ]}
    >
      {post.sponsored ? (
        <View
          style={[styles.sponsorPill, { backgroundColor: colors.sponsor }]}
        >
          <Feather name="zap" size={10} color="#fff" />
          <Text style={styles.sponsorText}>{post.sponsorLabel ?? "Sponsored"}</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Avatar source={author.avatar} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {author.name}
            </Text>
            {author.verified ? (
              <Feather
                name="check-circle"
                size={14}
                color={colors.primary}
                style={{ marginLeft: 4 }}
              />
            ) : null}
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {post.createdAt}
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.mutedForeground }]} numberOfLines={1}>
            {author.title} · {author.company}
          </Text>
        </View>
        <Pressable hitSlop={10} style={styles.more}>
          <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Text style={[styles.body, { color: colors.foreground }]}>
        {post.text}
      </Text>

      {post.image ? (
        <Image
          source={post.image}
          style={[
            styles.image,
            { backgroundColor: colors.cardElevated, borderColor: colors.border },
          ]}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.actions}>
        <Action
          icon="message-circle"
          value={formatNumber(post.comments)}
          color={colors.mutedForeground}
          onPress={() => {}}
        />
        <Action
          icon="repeat"
          value={formatNumber(post.retweets)}
          color={post.retweeted ? colors.success : colors.mutedForeground}
          onPress={onRetweet}
        />
        <Action
          icon="heart"
          value={formatNumber(post.likes)}
          color={post.liked ? colors.destructive : colors.mutedForeground}
          filled={post.liked}
          onPress={onLike}
        />
        <Action
          icon="dollar-sign"
          value={post.tips > 0 ? formatNumber(post.tips) : "Tip"}
          color={post.tips > 0 ? colors.tip : colors.mutedForeground}
          accent={colors.tip}
          onPress={() => setTipOpen(true)}
        />
      </View>

      <TipSheet
        visible={tipOpen}
        authorName={author.name}
        onClose={() => setTipOpen(false)}
        onTip={onTip}
      />
    </View>
  );
}

function Action({
  icon,
  value,
  color,
  filled,
  accent,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  color: string;
  filled?: boolean;
  accent?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
    >
      <Feather
        name={icon}
        size={16}
        color={color}
        style={filled && accent ? { opacity: 1 } : undefined}
      />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  sponsorPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    marginBottom: 12,
  },
  sponsorText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dot: {
    marginHorizontal: 6,
    fontSize: 14,
  },
  meta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flexShrink: 1,
  },
  title: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  more: {
    padding: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
