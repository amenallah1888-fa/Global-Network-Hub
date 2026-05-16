import { Feather } from "@expo/vector-icons";
import {
  getListPostsQueryKey,
  useCreatePost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/lib/userCache";

const CITIES = [
  "Tunis", "Cairo", "Lagos", "Nairobi", "Johannesburg", "Casablanca",
  "Dubai", "Istanbul", "London", "Paris", "Berlin", "New York",
  "San Francisco", "Singapore", "Tokyo", "São Paulo", "Mumbai",
];

const POLL_DURATIONS = ["1 day", "3 days", "7 days"];

function LocationModal({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (city: string) => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={lm.backdrop}>
        <Pressable style={lm.overlay} onPress={onClose} />
        <View style={[lm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={lm.handle} />
          <Text style={[lm.title, { color: colors.foreground }]}>Tag a City</Text>
          <Text style={[lm.sub, { color: colors.mutedForeground }]}>Pin your post to the Atlas map</Text>
          <View style={lm.grid}>
            {CITIES.map((city) => (
              <Pressable
                key={city}
                onPress={() => { onSelect(city); onClose(); }}
                style={({ pressed }) => [lm.chip, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Feather name="map-pin" size={11} color={colors.primary} />
                <Text style={[lm.chipText, { color: colors.foreground }]}>{city}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PollModal({ visible, onClose, onInsert }: {
  visible: boolean;
  onClose: () => void;
  onInsert: (pollText: string) => void;
}) {
  const colors = useColors();
  const [question, setQuestion] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [duration, setDuration] = useState("3 days");

  const handleInsert = () => {
    if (!question.trim() || !optA.trim() || !optB.trim()) {
      Alert.alert("Missing fields", "Question and at least 2 options are required.");
      return;
    }
    const opts = [optA, optB, optC].filter(Boolean).map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o}`).join("\n");
    const pollText = `📊 ${question.trim()}\n${opts}\n⏱ ${duration}`;
    onInsert(pollText);
    setQuestion(""); setOptA(""); setOptB(""); setOptC(""); setDuration("3 days");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={lm.backdrop}>
        <Pressable style={lm.overlay} onPress={onClose} />
        <View style={[lm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={lm.handle} />
          <Text style={[lm.title, { color: colors.foreground }]}>Create a Poll</Text>
          <Text style={[lm.sub, { color: colors.mutedForeground }]}>Ask your network a question</Text>

          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Your question…"
            placeholderTextColor={colors.mutedForeground}
            style={[lm.pollInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
          />
          <TextInput value={optA} onChangeText={setOptA} placeholder="Option A" placeholderTextColor={colors.mutedForeground}
            style={[lm.pollInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
          <TextInput value={optB} onChangeText={setOptB} placeholder="Option B" placeholderTextColor={colors.mutedForeground}
            style={[lm.pollInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
          <TextInput value={optC} onChangeText={setOptC} placeholder="Option C (optional)" placeholderTextColor={colors.mutedForeground}
            style={[lm.pollInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />

          <Text style={[lm.durationLabel, { color: colors.mutedForeground }]}>Duration</Text>
          <View style={lm.durationRow}>
            {POLL_DURATIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDuration(d)}
                style={[lm.durationChip, {
                  backgroundColor: duration === d ? colors.primary : colors.background,
                  borderColor: duration === d ? colors.primary : colors.border,
                }]}
              >
                <Text style={[lm.durationText, { color: duration === d ? "#fff" : colors.foreground }]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleInsert} style={({ pressed }) => [lm.insertBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={lm.insertBtnText}>Add Poll to Post</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function Composer() {
  const colors = useColors();
  const me = useCurrentUser();
  const { composeText, setComposeText } = useApp();
  const queryClient = useQueryClient();
  const create = useCreatePost();
  const [locationOpen, setLocationOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [taggedCity, setTaggedCity] = useState<string | null>(null);

  const canPost = composeText.trim().length > 0 && !create.isPending;

  const handlePost = () => {
    if (!canPost) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const textWithCity = taggedCity ? `${composeText.trim()}\n📍 ${taggedCity}` : composeText.trim();
    create.mutate(
      { data: { text: textWithCity } },
      {
        onSuccess: () => {
          setComposeText("");
          setTaggedCity(null);
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(), exact: false });
        },
      },
    );
  };

  const handleImage = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Image upload", "Image picking is available on the mobile app.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach images to posts.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Alert.alert("Image selected", "Full image upload coming with Pi Storage integration.");
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar avatarKey={me.avatarKey} size={40} />
      <View style={{ flex: 1 }}>
        <TextInput
          value={composeText}
          onChangeText={setComposeText}
          placeholder="Share an insight, opportunity, or question…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.input, {
            color: colors.foreground,
            ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
          }]}
        />
        {taggedCity && (
          <View style={[styles.cityTag, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
            <Feather name="map-pin" size={11} color={colors.primary} />
            <Text style={[styles.cityTagText, { color: colors.primary }]}>{taggedCity}</Text>
            <Pressable onPress={() => setTaggedCity(null)} hitSlop={6}>
              <Feather name="x" size={11} color={colors.primary} />
            </Pressable>
          </View>
        )}
        <View style={styles.actions}>
          <View style={styles.iconRow}>
            <IconBtn name="image" color={colors.mutedForeground} onPress={handleImage} />
            <IconBtn name="bar-chart-2" color={pollOpen ? colors.primary : colors.mutedForeground} onPress={() => setPollOpen(true)} />
            <IconBtn name="map-pin" color={taggedCity ? colors.primary : colors.mutedForeground} onPress={() => setLocationOpen(true)} />
          </View>
          <Pressable
            disabled={!canPost}
            onPress={handlePost}
            style={({ pressed }) => [styles.post, {
              backgroundColor: canPost ? colors.primary : colors.cardElevated,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <Feather name="send" size={14} color={canPost ? colors.primaryForeground : colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <LocationModal
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={(city) => setTaggedCity(city)}
      />
      <PollModal
        visible={pollOpen}
        onClose={() => setPollOpen(false)}
        onInsert={(pollText) => setComposeText((prev) => (prev ? prev + "\n\n" + pollText : pollText))}
      />
    </View>
  );
}

function IconBtn({ name, color, onPress }: { name: keyof typeof Feather.glyphMap; color: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}>
      <Feather name={name} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 8, marginBottom: 16, padding: 14, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 40, maxHeight: 110, paddingTop: 8, paddingBottom: 4 },
  cityTag: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginTop: 6 },
  cityTagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  iconRow: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 6 },
  post: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

const lm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 200 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  card: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, padding: 20, paddingTop: 12, gap: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 6 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  pollInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  durationLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  durationRow: { flexDirection: "row", gap: 8 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  durationText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  insertBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4, marginBottom: 10 },
  insertBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
