import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Destination = "story" | "reel";
// Bug 3 fix: step 2 is skipped when lockedDestination is provided
type Step = 1 | 2 | 3 | 4;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Bug 3: lock the composer to a specific destination, hiding the choice step */
  lockedDestination?: Destination;
};

const PROJECT_TAGS = [
  { id: "pi1", label: "Helix Labs" },
  { id: "pi2", label: "Polaris Robotics" },
  { id: "pi3", label: "Atelier Nord" },
];

const DEST_LABELS: Record<Destination, string> = {
  story: "Story",
  reel: "Reel",
};

export function StoryReelComposerSheet({ visible, onClose, lockedDestination }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [destination, setDestination] = useState<Destination>(lockedDestination ?? "story");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [projectTag, setProjectTag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadProgress = useRef(new Animated.Value(0)).current;

  const reset = () => {
    setStep(1);
    setMediaUri(null);
    setDestination(lockedDestination ?? "story");
    setCaption("");
    setHashtags("");
    setProjectTag(null);
    setUploading(false);
    uploadProgress.setValue(0);
  };

  const handleClose = () => { reset(); onClose(); };

  // After picking media: if destination is locked, skip step 2 and go straight to details
  const afterMediaPicked = (uri: string, type: "photo" | "video") => {
    setMediaUri(uri);
    setMediaType(type);
    if (lockedDestination) {
      setDestination(lockedDestination);
      setStep(3); // skip step 2
    } else {
      setStep(2);
    }
  };

  // ─── Step 1: Media selection ─────────────────────────────────────────────

  // Bug 4 fix: "Take Photo/Video" correctly opens the CAMERA
  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Allow camera access to take a photo or video.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (!result.canceled && result.assets[0]) {
      afterMediaPicked(result.assets[0].uri, result.assets[0].type === "video" ? "video" : "photo");
    }
  };

  // Bug 4 fix: "Choose from Gallery" correctly opens the LIBRARY
  const openGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Library access needed", "Allow access to your media library to pick a photo or video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (!result.canceled && result.assets[0]) {
      afterMediaPicked(result.assets[0].uri, result.assets[0].type === "video" ? "video" : "photo");
    }
  };

  // ─── Step 4: Simulate upload ─────────────────────────────────────────────
  const handlePublish = () => {
    setStep(4);
    setUploading(true);
    uploadProgress.setValue(0);
    Animated.timing(uploadProgress, {
      toValue: 1,
      duration: 2400,
      useNativeDriver: false,
    }).start(() => {
      setUploading(false);
      Alert.alert(
        destination === "story" ? "Story Posted!" : "Reel Published!",
        destination === "story"
          ? "Your Story is live for 24 hours."
          : "Your Reel has been published to the Reels feed.",
        [{ text: "Done", onPress: handleClose }],
      );
    });
  };

  // ─── Header title ─────────────────────────────────────────────────────────
  const getTitle = () => {
    if (lockedDestination) {
      // Bug 3 fix: title is specific when destination is locked
      const label = DEST_LABELS[lockedDestination];
      if (step === 1) return `Create ${label}`;
      if (step === 3) return `${label} Details`;
      return "Publishing…";
    }
    if (step === 1) return "Add Media";
    if (step === 2) return "Choose Destination";
    if (step === 3) return "Add Details";
    return "Publishing…";
  };

  const progressWidth = uploadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // Step dots: when destination is locked we only have 3 meaningful steps (1, 3, 4)
  // shown as 2-step progress (pick → details → done)
  const visibleStepCount = lockedDestination ? 2 : 3;
  const currentDotStep = lockedDestination
    ? (step === 1 ? 1 : step === 3 ? 2 : 2)
    : (step <= 3 ? step : 3);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[rc.backdrop, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={[rc.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={rc.handle} />

          {/* Header */}
          <View style={[rc.header, { borderBottomColor: colors.border }]}>
            {step > 1 && step < 4 ? (
              <Pressable
                onPress={() => {
                  if (lockedDestination && step === 3) {
                    setStep(1); // skip back over step 2 when locked
                  } else {
                    setStep((s) => (s - 1) as Step);
                  }
                }}
                hitSlop={10}
              >
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </Pressable>
            ) : <View style={{ width: 24 }} />}
            <Text style={[rc.title, { color: colors.foreground }]}>{getTitle()}</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Step dots */}
          <View style={rc.stepDots}>
            {Array.from({ length: visibleStepCount }).map((_, i) => (
              <View
                key={i}
                style={[
                  rc.dot,
                  { backgroundColor: currentDotStep > i ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>

          {/* ── STEP 1: Select media ── */}
          {step === 1 && (
            <View style={rc.body}>
              <Text style={[rc.stepHint, { color: colors.mutedForeground }]}>
                {lockedDestination === "story"
                  ? "Add a photo or video to your Story"
                  : lockedDestination === "reel"
                  ? "Add a video for your Reel"
                  : "Pick your media first"}
              </Text>
              <View style={rc.mediaOptions}>
                {/* Bug 4 fix: button correctly labeled and wired to camera */}
                <Pressable
                  onPress={openCamera}
                  style={({ pressed }) => [
                    rc.mediaBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="camera" size={24} color="#fff" />
                  <Text style={rc.mediaBtnText}>Take Photo/Video</Text>
                </Pressable>

                {/* Bug 4 fix: button correctly labeled and wired to gallery */}
                <Pressable
                  onPress={openGallery}
                  style={({ pressed }) => [
                    rc.mediaBtn,
                    { backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="image" size={24} color={colors.foreground} />
                  <Text style={[rc.mediaBtnText, { color: colors.foreground }]}>Choose from Gallery</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── STEP 2: Destination (only shown when NOT locked) ── */}
          {step === 2 && !lockedDestination && (
            <View style={rc.body}>
              {mediaUri ? (
                <Image source={{ uri: mediaUri }} style={rc.preview} contentFit="cover" />
              ) : null}
              <Text style={[rc.stepHint, { color: colors.mutedForeground }]}>
                Where should this go?
              </Text>
              <View style={rc.destRow}>
                {([
                  { key: "story", icon: "circle", label: "Story", sub: "Visible 24 hours" },
                  { key: "reel", icon: "play-circle", label: "Reel", sub: "Permanent video feed" },
                ] as const).map(({ key, icon, label, sub }) => (
                  <Pressable
                    key={key}
                    onPress={() => setDestination(key)}
                    style={[
                      rc.destCard,
                      {
                        backgroundColor: destination === key ? colors.primary + "15" : colors.background,
                        borderColor: destination === key ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather name={icon} size={26} color={destination === key ? colors.primary : colors.mutedForeground} />
                    <Text style={[rc.destLabel, { color: destination === key ? colors.primary : colors.foreground }]}>{label}</Text>
                    <Text style={[rc.destSub, { color: colors.mutedForeground }]}>{sub}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setStep(3)}
                style={({ pressed }) => [rc.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={rc.nextBtnText}>Continue</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* ── STEP 3: Metadata ── */}
          {step === 3 && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={rc.body} keyboardShouldPersistTaps="handled">
              {mediaUri ? (
                <Image source={{ uri: mediaUri }} style={rc.previewSmall} contentFit="cover" />
              ) : null}
              <Text style={[rc.stepHint, { color: colors.mutedForeground }]}>Add a caption and optional project tag</Text>
              <View style={rc.fieldWrap}>
                <Text style={[rc.label, { color: colors.mutedForeground }]}>Caption</Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Say something..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[rc.textarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>
              <View style={rc.fieldWrap}>
                <Text style={[rc.label, { color: colors.mutedForeground }]}>Hashtags</Text>
                <TextInput
                  value={hashtags}
                  onChangeText={setHashtags}
                  placeholder="#founders #synbio #investing"
                  placeholderTextColor={colors.mutedForeground}
                  style={[rc.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>
              <View style={rc.fieldWrap}>
                <Text style={[rc.label, { color: colors.mutedForeground }]}>Tag a Project (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {PROJECT_TAGS.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setProjectTag(projectTag === p.id ? null : p.id)}
                      style={[
                        rc.tagChip,
                        {
                          backgroundColor: projectTag === p.id ? colors.primary + "15" : colors.background,
                          borderColor: projectTag === p.id ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Feather name="zap" size={12} color={projectTag === p.id ? colors.primary : colors.mutedForeground} />
                      <Text style={{ color: projectTag === p.id ? colors.primary : colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <Pressable
                onPress={handlePublish}
                style={({ pressed }) => [rc.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 8 }]}
              >
                <Feather name={destination === "story" ? "circle" : "play-circle"} size={16} color="#fff" />
                <Text style={rc.nextBtnText}>
                  {destination === "story" ? "Post Story" : "Publish Reel"}
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {/* ── STEP 4: Uploading ── */}
          {step === 4 && (
            <View style={[rc.body, { alignItems: "center", gap: 20 }]}>
              <View style={[rc.uploadIcon, { backgroundColor: colors.primary + "15" }]}>
                {uploading ? (
                  <ActivityIndicator color={colors.primary} size="large" />
                ) : (
                  <Feather name="check-circle" size={36} color={colors.success} />
                )}
              </View>
              <Text style={[rc.uploadTitle, { color: colors.foreground }]}>
                {uploading ? `Uploading ${DEST_LABELS[destination]}…` : "Published!"}
              </Text>
              <View style={[rc.progressTrack, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={[rc.progressBar, { width: progressWidth, backgroundColor: colors.primary }]}
                />
              </View>
              <Text style={[rc.uploadSub, { color: colors.mutedForeground }]}>
                {uploading
                  ? `Delivering to ${destination === "story" ? "Stories" : "Reels feed"}...`
                  : "Your content is live."}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const rc = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, maxHeight: "92%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  stepDots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { padding: 20, gap: 16 },
  stepHint: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  mediaOptions: { flexDirection: "row", gap: 14, justifyContent: "center" },
  mediaBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 28, borderRadius: 20,
  },
  mediaBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  preview: { width: "100%", height: 160, borderRadius: 14 },
  previewSmall: { width: "100%", height: 110, borderRadius: 12 },
  destRow: { flexDirection: "row", gap: 12 },
  destCard: {
    flex: 1, alignItems: "center", gap: 8, padding: 18, borderRadius: 18, borderWidth: 2,
  },
  destLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  destSub: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 15,
  },
  nextBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  fieldWrap: { gap: 6 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  textarea: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top",
  },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
  },
  uploadIcon: {
    width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  uploadTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  progressTrack: { width: "100%", height: 6, borderRadius: 3, overflow: "hidden" },
  progressBar: { height: 6, borderRadius: 3 },
  uploadSub: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
