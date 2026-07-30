import { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, KeyboardAvoidingView, Modal,
  Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { getImage } from "@/lib/imageMap";
import type { StoryItem } from "./StoriesBar";

const { width: SW } = Dimensions.get("window");
const STORY_DURATION = 15000;

const STORY_MEDIA: Record<string, { imageKey: string; caption: string }> = {
  u_amelia: { imageKey: "post1", caption: "Just closed our $42M Series B. Next stop: pre-seed operators only." },
  u_marcus: { imageKey: "post2", caption: "Prototype shipped. Months of late nights. Worth every one." },
  u_priya:  { imageKey: "post1", caption: "Ledger Cloud live in 12 new markets. Growth never stops." },
  u_jonas:  { imageKey: "post2", caption: "New warehouse retrofit in Oslo — 48-hour turnaround, as promised." },
};

type Props = {
  visible: boolean;
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
  onViewed: (userId: string) => void;
};

export function StoryViewer({ visible, stories, startIndex, onClose, onViewed }: Props) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(startIndex);
  const [reply, setReply] = useState("");
  // Bug 1 fix: like state is isolated per story ID — never bleeds across stories
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const story = stories[current];
  const media = story ? STORY_MEDIA[story.userId] : null;
  const liked = story ? (likedMap[story.userId] ?? false) : false;

  const toggleLike = () => {
    if (!story) return;
    setLikedMap((prev) => ({ ...prev, [story.userId]: !prev[story.userId] }));
  };

  const startProgress = () => {
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) advanceStory();
    });
  };

  const advanceStory = () => {
    if (story) onViewed(story.userId);
    if (current < stories.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  // Bug 1 fix: reset both position and liked-map whenever viewer opens fresh
  useEffect(() => {
    if (visible) {
      setCurrent(startIndex);
      setLikedMap({});
      setReply("");
    }
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible) return;
    if (animRef.current) animRef.current.stop();
    startProgress();
    return () => { if (animRef.current) animRef.current.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, visible]);

  // Bug 2 fix: reply routes into the DM / Chat system
  const handleSendReply = () => {
    const text = reply.trim();
    if (!text || !story) return;
    setReply("");
    if (animRef.current) animRef.current.stop();
    onClose();
    // Navigate to the DM thread with the draft pre-filled
    router.push(`/chat/${story.userId}?draft=${encodeURIComponent(text)}`);
  };

  if (!story) return null;

  const imgSrc = getImage(media?.imageKey ?? "post1");

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={sv.root}>
        {/* Background */}
        <Image source={imgSrc} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <View style={sv.dimOverlay} />

        {/* Progress bars */}
        <View style={[sv.progressRow, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
          {stories.map((s, i) => (
            <View key={s.userId} style={sv.progressTrack}>
              {i < current ? (
                <View style={[sv.progressFill, { width: "100%", backgroundColor: "#fff" }]} />
              ) : i === current ? (
                <Animated.View
                  style={[
                    sv.progressFill,
                    {
                      width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                      backgroundColor: "#fff",
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>

        {/* User header */}
        <View style={sv.header}>
          <Avatar avatarKey={story.avatarKey} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={sv.name}>{story.name}</Text>
          </View>
          {/* Bug 2: DM shortcut — tap name to open chat */}
          <Pressable
            onPress={() => { onClose(); router.push(`/chat/${story.userId}`); }}
            style={({ pressed }) => [sv.dmBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Feather name="message-circle" size={18} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Text style={sv.timeAgo}>2h ago</Text>
          <Pressable onPress={onClose} hitSlop={14} style={sv.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Tap zones */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable style={sv.tapLeft} onPress={goBack} />
          <Pressable style={sv.tapRight} onPress={advanceStory} />
        </View>

        {/* Caption */}
        {media?.caption ? (
          <View style={sv.captionWrap}>
            <Text style={sv.caption}>{media.caption}</Text>
          </View>
        ) : null}

        {/* Bottom reactions + reply */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={sv.bottom}
        >
          <View style={sv.reactRow}>
            {/* Bug 1 fix: like uses per-story state */}
            <Pressable
              onPress={toggleLike}
              style={({ pressed }) => [sv.reactBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="heart" size={24} color={liked ? "#EF4444" : "#fff"} />
              <Text style={sv.reactLabel}>{liked ? "Liked" : "Like"}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [sv.reactBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="zap" size={24} color="#D4AF7A" />
              <Text style={sv.reactLabel}>Tip π</Text>
            </Pressable>
          </View>

          {/* Bug 2 fix: reply sends to DM, hint label updated */}
          <View style={[sv.replyRow, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder={`Message ${story.name}… (sends as DM)`}
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={sv.replyInput}
              returnKeyType="send"
              onSubmitEditing={handleSendReply}
            />
            {reply.length > 0 && (
              <Pressable
                onPress={handleSendReply}
                style={({ pressed }) => [sv.sendBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="send" size={17} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const sv = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.30)" },
  progressRow: {
    flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingBottom: 10, zIndex: 20,
  },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden",
  },
  progressFill: { height: 3, borderRadius: 2 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingBottom: 10, zIndex: 20,
  },
  name: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dmBtn: { padding: 4 },
  timeAgo: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular" },
  closeBtn: { padding: 4 },
  tapLeft: { position: "absolute", left: 0, top: 80, bottom: 200, width: SW * 0.35 },
  tapRight: { position: "absolute", right: 0, top: 80, bottom: 200, width: SW * 0.55 },
  captionWrap: {
    position: "absolute", bottom: 155, left: 0, right: 0, paddingHorizontal: 20, zIndex: 20,
  },
  caption: {
    color: "#fff", fontSize: 15, fontFamily: "Inter_500Medium", lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.85)", textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 30 },
  reactRow: {
    flexDirection: "row", justifyContent: "flex-end", gap: 24,
    paddingHorizontal: 20, paddingBottom: 10,
  },
  reactBtn: { alignItems: "center", gap: 4 },
  reactLabel: {
    color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold",
    textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  replyRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 4,
  },
  replyInput: {
    flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
});
