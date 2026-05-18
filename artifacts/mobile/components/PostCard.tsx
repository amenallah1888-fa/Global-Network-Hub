import { Feather } from "@expo/vector-icons";
import {
  useTipPost,
  useToggleLike,
  useToggleRetweet,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { TipSheet } from "@/components/TipSheet";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getImage } from "@/lib/imageMap";
import { useCurrentUserId, useUserById } from "@/lib/userCache";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

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
  return `${Math.floor(h / 24)}d`;
}

type CommentData = {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string; handle: string; avatarKey: string | null; verified: boolean } | null;
};

function CommentThread({ postId, onClose }: { postId: string; onClose: () => void }) {
  const colors = useColors();
  const { token } = useAuth();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useState(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setComments(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  });

  const submitComment = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setText("");
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={[thread.wrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[thread.header, { borderBottomColor: colors.border }]}>
        <Text style={[thread.title, { color: colors.foreground }]}>
          {comments.length} Comment{comments.length !== 1 ? "s" : ""}
        </Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Feather name="chevron-up" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={thread.center}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : comments.length === 0 ? (
        <View style={thread.center}>
          <Text style={[thread.empty, { color: colors.mutedForeground }]}>Be the first to comment</Text>
        </View>
      ) : (
        comments.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => c.author && router.push(`/profile/${c.authorId}`)}
            style={thread.commentRow}
          >
            <Avatar avatarKey={c.author?.avatarKey ?? null} size={30} />
            <View style={[thread.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={thread.commentHeader}>
                <Text style={[thread.commentName, { color: colors.foreground }]}>{c.author?.name ?? "User"}</Text>
                {c.author?.verified && <Feather name="check-circle" size={11} color={colors.primary} />}
                <Text style={[thread.commentTime, { color: colors.mutedForeground }]}>{formatRelative(c.createdAt)}</Text>
              </View>
              <Text style={[thread.commentText, { color: colors.foreground }]}>{c.text}</Text>
            </View>
          </Pressable>
        ))
      )}

      <View style={[thread.inputRow, { borderTopColor: colors.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a comment…"
          placeholderTextColor={colors.mutedForeground}
          style={[thread.input, {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
            ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
          }]}
          onSubmitEditing={submitComment}
          returnKeyType="send"
        />
        <Pressable
          onPress={submitComment}
          disabled={posting || !text.trim()}
          style={({ pressed }) => [thread.sendBtn, {
            backgroundColor: text.trim() ? colors.primary : colors.cardElevated,
            opacity: pressed || posting ? 0.7 : 1,
          }]}
        >
          {posting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={14} color={text.trim() ? "#fff" : colors.mutedForeground} />}
        </Pressable>
      </View>
    </View>
  );
}

type MenuOption = { label: string; icon: keyof typeof Feather.glyphMap; destructive?: boolean; onPress: () => void };

function PostMenu({ visible, onClose, options, colors }: {
  visible: boolean;
  onClose: () => void;
  options: MenuOption[];
  colors: ReturnType<typeof useColors>;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menu.backdrop} onPress={onClose}>
        <View style={[menu.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {options.map((opt, i) => (
            <Pressable
              key={opt.label}
              onPress={() => { onClose(); opt.onPress(); }}
              style={({ pressed }) => [
                menu.item,
                i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                pressed && { backgroundColor: colors.cardElevated },
              ]}
            >
              <Feather name={opt.icon} size={15} color={opt.destructive ? "#EF4444" : colors.foreground} />
              <Text style={[menu.itemText, { color: opt.destructive ? "#EF4444" : colors.foreground }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const menu = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  card: { width: 240, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 15 },
  itemText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});

export function PostCard({ post, hidden: hiddenProp = false }: { post: Post; hidden?: boolean }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const author = useUserById(post.authorId);
  const [tipOpen, setTipOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(hiddenProp);
  const image = getImage(post.imageKey);

  if (hidden) return null;

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
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMut.mutate({ id: post.id }, { onSuccess: patchPost });
  };
  const onRetweet = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    rtMut.mutate({ id: post.id }, { onSuccess: patchPost });
  };
  const onTip = (amount: number) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    tipMut.mutate({ id: post.id, data: { amount } }, { onSuccess: patchPost });
    setTipOpen(false);
  };

  const onComment = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCommentsOpen((v) => !v);
  };

  const handleCopyLink = async () => {
    const link = `https://oasis.app/post/${post.id}`;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        const { setStringAsync } = await import("expo-clipboard");
        await setStringAsync(link);
      }
    } catch {}
  };

  const handleReport = async () => {
    try {
      await fetch(`${API_BASE}/api/posts/${post.id}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_report" }),
      });
    } catch {}
  };

  const menuOptions: MenuOption[] = [
    { label: "Copy Link to Post", icon: "link", onPress: handleCopyLink },
    { label: "Report Post", icon: "flag", destructive: true, onPress: handleReport },
    { label: "Hide Post", icon: "eye-off", destructive: true, onPress: () => setHidden(true) },
  ];

  const goToProfile = () => router.push(`/profile/${post.authorId}`);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: post.sponsored ? colors.sponsor : colors.border }]}>
      {post.sponsored ? (
        <View style={[styles.sponsorPill, { backgroundColor: colors.sponsor }]}>
          <Feather name="zap" size={10} color="#fff" />
          <Text style={styles.sponsorText}>{post.sponsorLabel ?? "Sponsored"}</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Pressable onPress={goToProfile} style={styles.avatarPressable}>
          <Avatar avatarKey={author.avatarKey} size={44} />
        </Pressable>
        <Pressable onPress={goToProfile} style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{author.name}</Text>
            {author.verified ? <Feather name="check-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} /> : null}
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {post.sponsored ? "Sponsored" : formatRelative(post.createdAt)}
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.mutedForeground }]} numberOfLines={1}>
            {author.title} · {author.company}
          </Text>
        </Pressable>
        <Pressable hitSlop={10} onPress={() => setMenuOpen(true)} style={styles.more}>
          <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Text style={[styles.body, { color: colors.foreground }]}>{post.text}</Text>

      {image ? (
        <Image
          source={image}
          style={[styles.image, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.actions}>
        <Action
          icon="message-circle"
          value={formatNumber(post.commentsCount)}
          color={commentsOpen ? colors.primary : colors.mutedForeground}
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
          value={post.tipsTotal > 0 ? formatNumber(post.tipsTotal) + " π" : "Tip"}
          color={post.tipsTotal > 0 ? colors.tip : colors.mutedForeground}
          onPress={() => setTipOpen(true)}
        />
      </View>

      {commentsOpen && (
        <CommentThread postId={post.id} onClose={() => setCommentsOpen(false)} />
      )}

      <PostMenu visible={menuOpen} onClose={() => setMenuOpen(false)} options={menuOptions} colors={colors} />

      <TipSheet
        visible={tipOpen}
        authorName={author.name}
        onClose={() => setTipOpen(false)}
        onTip={onTip}
      />
    </View>
  );
}

function Action({ icon, value, color, onPress }: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 18, marginHorizontal: 16, marginBottom: 14 },
  sponsorPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, gap: 4, marginBottom: 12 },
  sponsorText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatarPressable: { borderRadius: 22 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dot: { marginHorizontal: 6, fontSize: 14 },
  meta: { fontSize: 13, fontFamily: "Inter_400Regular", flexShrink: 1 },
  title: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  more: { padding: 4 },
  body: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14, borderWidth: 1, marginTop: 14 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 6 },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

const thread = StyleSheet.create({
  wrap: { marginTop: 14, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  title: { fontSize: 13, fontFamily: "Inter_700Bold" },
  center: { paddingVertical: 16, alignItems: "center" },
  empty: { fontSize: 13, fontFamily: "Inter_500Medium" },
  commentRow: { flexDirection: "row", gap: 8, padding: 10, alignItems: "flex-start" },
  bubble: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  commentName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  commentTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  commentText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  inputRow: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
