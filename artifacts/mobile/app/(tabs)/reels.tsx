import { useRef, useState, useCallback } from "react";
import {
  Dimensions, FlatList, Pressable, StyleSheet, Text, View,
  ViewToken, Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { StoryReelComposerSheet } from "@/components/StoryReelComposerSheet";
import { getImage } from "@/lib/imageMap";

const { width: SW, height: SH } = Dimensions.get("window");

type Reel = {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatarKey: string | null;
  imageKey: string;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  projectTag?: { id: string; label: string };
};

const MOCK_REELS: Reel[] = [
  {
    id: "r1",
    userId: "u_amelia",
    name: "Amelia Chen",
    handle: "ameliac",
    avatarKey: "avatar2",
    imageKey: "post1",
    caption: "The Series B closed. Now we execute. 47 portfolio companies, zero excuses.",
    hashtags: ["#seriesb", "#venturecapital", "#operators"],
    likes: 4820,
    comments: 312,
    projectTag: { id: "pi1", label: "Helix Labs" },
  },
  {
    id: "r2",
    userId: "u_marcus",
    name: "Marcus Vale",
    handle: "marcusv",
    avatarKey: "avatar3",
    imageKey: "post2",
    caption: "Three months. Fourteen prototypes. This is the one.",
    hashtags: ["#productdesign", "#craft", "#ateliernord"],
    likes: 2140,
    comments: 97,
  },
  {
    id: "r3",
    userId: "u_me",
    name: "Alex Rivera",
    handle: "alex",
    avatarKey: "avatar1",
    imageKey: "post1",
    caption: "47 automated experiments while the team slept. This is synthetic biology at scale.",
    hashtags: ["#synbio", "#biotech", "#helixlabs"],
    likes: 3388,
    comments: 214,
    projectTag: { id: "pi1", label: "Helix Labs" },
  },
  {
    id: "r4",
    userId: "u_priya",
    name: "Priya Anand",
    handle: "priya",
    avatarKey: "avatar1",
    imageKey: "post2",
    caption: "12 new markets, one quarter. Ledger Cloud is just getting started.",
    hashtags: ["#fintech", "#b2b", "#saas"],
    likes: 1920,
    comments: 88,
    projectTag: { id: "pi4", label: "Ledger Cloud" },
  },
  {
    id: "r5",
    userId: "u_jonas",
    name: "Jonas Holm",
    handle: "jonash",
    avatarKey: "avatar2",
    imageKey: "post1",
    caption: "Oslo retrofit complete. 48 hours, zero downtime. Hardware is eating the world.",
    hashtags: ["#robotics", "#warehouse", "#hardwareishard"],
    likes: 1460,
    comments: 73,
    projectTag: { id: "pi2", label: "Polaris Robotics" },
  },
];

function ReelItem({ reel, isActive }: { reel: Reel; isActive: boolean }) {
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.likes);
  const [muted, setMuted] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");

  const imgSrc = getImage(reel.imageKey);

  const handleLike = () => {
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
  };

  return (
    <View style={[ri.root, { width: SW, height: SH }]}>
      {/* Full-screen media */}
      <Image source={imgSrc} style={StyleSheet.absoluteFillObject} contentFit="cover" />

      {/* Dark gradient at bottom */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.75)"]}
        style={ri.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Play overlay (visual indicator since no actual video) */}
      {isActive && (
        <View style={ri.playHint} pointerEvents="none">
          <Feather name="play" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={ri.playHintText}>Reel</Text>
        </View>
      )}

      {/* ─── RIGHT SIDE CONTROLS ─── */}
      <View style={[ri.rightControls, { paddingBottom: insets.bottom + 80 }]}>
        {/* Creator avatar */}
        <Pressable onPress={() => router.push(`/profile/${reel.userId}`)} style={ri.avatarWrap}>
          <Avatar avatarKey={reel.avatarKey} size={44} />
          <View style={[ri.followDot, { backgroundColor: "#fff" }]}>
            <Feather name="plus" size={10} color="#000" />
          </View>
        </Pressable>

        {/* Mute */}
        <Pressable onPress={() => setMuted((v) => !v)} style={ri.controlBtn}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={26} color="#fff" />
        </Pressable>

        {/* Like */}
        <Pressable onPress={handleLike} style={ri.controlBtn}>
          <Feather name="heart" size={28} color={liked ? "#EF4444" : "#fff"} />
          <Text style={ri.controlCount}>{formatCount(likeCount)}</Text>
        </Pressable>

        {/* Comment */}
        <Pressable onPress={() => setCommentsOpen(true)} style={ri.controlBtn}>
          <Feather name="message-circle" size={26} color="#fff" />
          <Text style={ri.controlCount}>{formatCount(reel.comments)}</Text>
        </Pressable>

        {/* Share */}
        <Pressable style={ri.controlBtn}>
          <Feather name="share-2" size={24} color="#fff" />
        </Pressable>

        {/* Pi Tip */}
        <Pressable style={ri.tipBtn}>
          <Text style={ri.tipPi}>π</Text>
          <Text style={ri.tipLabel}>Support</Text>
        </Pressable>
      </View>

      {/* ─── BOTTOM LEFT INFO ─── */}
      <View style={[ri.leftInfo, { paddingBottom: insets.bottom + 88 }]}>
        <Text style={ri.username}>@{reel.handle}</Text>
        <Text style={ri.caption} numberOfLines={3}>{reel.caption}</Text>
        <Text style={ri.hashtags} numberOfLines={1}>{reel.hashtags.join(" ")}</Text>

        {/* Project tag card */}
        {reel.projectTag && (
          <Pressable
            onPress={() => router.push(`/pitch/${reel.projectTag!.id}`)}
            style={ri.projectCard}
          >
            <Feather name="zap" size={12} color="#D4AF7A" />
            <Text style={ri.projectLabel}>{reel.projectTag.label}</Text>
            <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}
      </View>

      {/* ─── COMMENTS BOTTOM SHEET ─── */}
      <Modal visible={commentsOpen} transparent animationType="slide" onRequestClose={() => setCommentsOpen(false)}>
        <Pressable style={ri.commentsBackdrop} onPress={() => setCommentsOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={ri.commentsSheet}>
          <View style={ri.commentsHandle} />
          <Text style={ri.commentsTitle}>Comments</Text>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Feather name="message-circle" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={ri.commentsEmpty}>Be the first to comment</Text>
          </View>
          <View style={[ri.commentsInputRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={ri.commentsInput}
              returnKeyType="send"
              onSubmitEditing={() => setComment("")}
            />
            <Pressable style={ri.commentsSendBtn} onPress={() => setComment("")}>
              <Feather name="send" size={16} color={comment.length > 0 ? "#D4AF7A" : "rgba(255,255,255,0.4)"} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return (
    <View style={rs.root}>
      <FlatList
        data={MOCK_REELS}
        keyExtractor={(r) => r.id}
        renderItem={({ item, index }) => (
          <ReelItem reel={item} isActive={index === activeIndex} />
        )}
        pagingEnabled
        snapToInterval={SH}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
      />

      {/* Top bar */}
      <View style={[rs.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={rs.topTitle}>Reels</Text>
        <Pressable
          onPress={() => setComposerOpen(true)}
          style={({ pressed }) => [rs.createBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus-square" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Bug 3: Reel composer opened from Reels tab is locked to "reel" */}
      <StoryReelComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} lockedDestination="reel" />
    </View>
  );
}

const ri = StyleSheet.create({
  root: { backgroundColor: "#000" },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: SH * 0.55 },
  playHint: {
    position: "absolute", top: 20, left: 20,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
  },
  playHintText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  rightControls: {
    position: "absolute", right: 12, bottom: 0,
    alignItems: "center", gap: 20,
  },
  avatarWrap: { position: "relative", alignItems: "center" },
  followDot: {
    position: "absolute", bottom: -4, left: "50%",
    width: 18, height: 18, borderRadius: 9, marginLeft: -9,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#000",
  },
  controlBtn: { alignItems: "center", gap: 4 },
  controlCount: {
    color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  tipBtn: {
    alignItems: "center", gap: 3,
    backgroundColor: "rgba(212,175,122,0.2)", borderRadius: 99, borderWidth: 1, borderColor: "#D4AF7A",
    paddingHorizontal: 10, paddingVertical: 8,
  },
  tipPi: {
    color: "#D4AF7A", fontSize: 18, fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  tipLabel: { color: "#D4AF7A", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  leftInfo: { position: "absolute", left: 14, bottom: 0, right: 80, gap: 6 },
  username: {
    color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  caption: {
    color: "rgba(255,255,255,0.92)", fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19,
    textShadowColor: "rgba(0,0,0,0.65)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  hashtags: {
    color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_500Medium",
  },
  projectCard: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,175,122,0.4)",
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 2,
  },
  projectLabel: { color: "#D4AF7A", fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  commentsBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  commentsSheet: {
    height: SH * 0.6, backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16,
  },
  commentsHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#444", alignSelf: "center", marginBottom: 12,
  },
  commentsTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 16 },
  commentsEmpty: { color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 10 },
  commentsInputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 12,
  },
  commentsInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular",
  },
  commentsSendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

const rs = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 10,
  },
  topTitle: {
    color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  createBtn: { padding: 4 },
});
