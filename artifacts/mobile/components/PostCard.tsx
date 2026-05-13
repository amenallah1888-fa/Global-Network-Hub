import { Feather } from "@expo/vector-icons";
import {
  useTipPost,
  useToggleLike,
  useToggleRetweet,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { TipSheet } from "@/components/TipSheet";
import { useColors } from "@/hooks/useColors";
import { getImage } from "@/lib/imageMap";
import { useUserById } from "@/lib/userCache";

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

export function PostCard({ post }: { post: Post }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const author = useUserById(post.authorId);
  const [tipOpen, setTipOpen] = useState(false);
  const image = getImage(post.imageKey);

  const patchPost = (updated: Post) => {
    queryClient.setQueriesData<Post[]>(
      { queryKey: ["/api/posts"], exact: false },
      (old) => old?.map((p) => (p.id === updated.id ? updated : p)),
    );
  };

  const likeMut = useToggleLike();
  const rtMut = useToggleRetweet();
  const tipMut = useTipPost();

  const onLike = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    likeMut.mutate({ id: post.id }, { onSuccess: patchPost });
  };
  const onRetweet = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    rtMut.mutate({ id: post.id }, { onSuccess: patchPost });
  };
  const onTip = (amount: number) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    tipMut.mutate(
      { id: post.id, data: { amount } },
      { onSuccess: patchPost },
    );
    setTipOpen(false);
  };

  const onComment = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      `${post.commentsCount} comment${post.commentsCount === 1 ? "" : "s"}`,
      "Full comment threads are coming soon. Stay tuned!",
      [{ text: "OK" }],
    );
  };

  const onMore = () => {
    Alert.alert("Post options", undefined, [
      { text: "Copy text", onPress: () => {} },
      { text: "Report post", style: "destructive", onPress: () => {} },
      { text: "Cancel", style: "cancel" },
    ]);
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
          <Text style={styles.sponsorText}>
            {post.sponsorLabel ?? "Sponsored"}
          </Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Avatar avatarKey={author.avatarKey} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { color: colors.foreground }]}
              numberOfLines={1}
            >
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
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>
              ·
            </Text>
            <Text
              style={[styles.meta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {post.sponsored ? "Sponsored" : formatRelative(post.createdAt)}
            </Text>
          </View>
          <Text
            style={[styles.title, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {author.title} · {author.company}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={onMore} style={styles.more}>
          <Feather
            name="more-horizontal"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <Text style={[styles.body, { color: colors.foreground }]}>
        {post.text}
      </Text>

      {image ? (
        <Image
          source={image}
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
          value={formatNumber(post.commentsCount)}
          color={colors.mutedForeground}
          onPress={onComment}
        />
        <Action
          icon="repeat"
          value={formatNumber(post.retweetsCount)}
          color={post.retweeted ? colors.success : colors.mutedForeground}
          onPress={onRetweet}
        />
        <Action
          icon="heart"
          value={formatNumber(post.likesCount)}
          color={post.liked ? colors.destructive : colors.mutedForeground}
          onPress={onLike}
        />
        <Action
          icon="dollar-sign"
          value={post.tipsTotal > 0 ? "$" + formatNumber(post.tipsTotal) : "Tip"}
          color={post.tipsTotal > 0 ? colors.tip : colors.mutedForeground}
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
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={16} color={color} />
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
