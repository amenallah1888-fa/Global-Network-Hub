import { Feather } from "@expo/vector-icons";
import {
  getListMarkersQueryKey,
  getListPitchesQueryKey,
  useCreatePitch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { COVER_PRESETS, getImage } from "@/lib/imageMap";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STAGES = ["Pre-seed", "Seed", "Series A", "Series B"];
const INDUSTRIES = [
  "BioTech",
  "AI",
  "Climate",
  "Robotics",
  "Commerce",
  "FinTech",
  "DeepTech",
  "Creative",
];

const CITIES: { name: string; x: number; y: number }[] = [
  { name: "San Francisco", x: 0.16, y: 0.36 },
  { name: "New York", x: 0.27, y: 0.34 },
  { name: "London", x: 0.48, y: 0.27 },
  { name: "Berlin", x: 0.51, y: 0.28 },
  { name: "Stockholm", x: 0.52, y: 0.22 },
  { name: "Lagos", x: 0.5, y: 0.55 },
  { name: "Bengaluru", x: 0.69, y: 0.49 },
  { name: "Singapore", x: 0.78, y: 0.55 },
  { name: "Tokyo", x: 0.84, y: 0.4 },
  { name: "Sydney", x: 0.88, y: 0.74 },
  { name: "São Paulo", x: 0.34, y: 0.66 },
  { name: "Casablanca", x: 0.46, y: 0.42 },
];

export function PitchComposerSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const create = useCreatePitch();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [raisingStr, setRaisingStr] = useState("");
  const [stage, setStage] = useState<string>("Seed");
  const [industry, setIndustry] = useState<string>("AI");
  const [cityName, setCityName] = useState<string>("San Francisco");
  const [coverKey, setCoverKey] = useState<string | null>("post1");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.spring(slide, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [visible, slide]);

  const reset = () => {
    setTitle("");
    setSummary("");
    setRaisingStr("");
    setStage("Seed");
    setIndustry("AI");
    setCityName("San Francisco");
    setCoverKey("post1");
    setPickedUri(null);
    setError(null);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 250);
  };

  const raising = useMemo(() => {
    const n = parseFloat(raisingStr.replace(/[, $]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
  }, [raisingStr]);

  const canSubmit =
    title.trim().length > 2 &&
    summary.trim().length > 8 &&
    raising > 0 &&
    !create.isPending;

  const pickImage = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      if (asset.base64) {
        const mime = asset.mimeType ?? "image/jpeg";
        const dataUrl = `data:${mime};base64,${asset.base64}`;
        setPickedUri(asset.uri);
        setCoverKey(dataUrl);
      } else if (asset.uri) {
        setPickedUri(asset.uri);
        setCoverKey(asset.uri);
      }
      if (Platform.OS !== "web") Haptics.selectionAsync();
    } catch (e) {
      setError("Could not load image. Try a different file.");
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    const city = CITIES.find((c) => c.name === cityName) ?? CITIES[0];
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    create.mutate(
      {
        data: {
          title: title.trim(),
          summary: summary.trim(),
          raising,
          stage,
          industry,
          city: city.name,
          coverKey,
          x: city.x,
          y: city.y,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListPitchesQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListMarkersQueryKey(),
          });
          handleClose();
        },
        onError: () => {
          setError("Could not publish pitch. Please try again.");
        },
      },
    );
  };

  const previewCover = pickedUri
    ? { uri: pickedUri }
    : coverKey
      ? getImage(coverKey)
      : undefined;

  const sheetTransform = {
    transform: [
      {
        translateY: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [Dimensions.get("window").height, 0],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.background },
            sheetTransform,
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>
                  NEW PITCH
                </Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Publish to the Hub
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.iconClose,
                  {
                    backgroundColor: colors.cardElevated,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable onPress={pickImage} style={styles.coverWrap}>
                {previewCover ? (
                  <Image source={previewCover} style={styles.coverImg} />
                ) : (
                  <View
                    style={[
                      styles.coverPlaceholder,
                      {
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name="image"
                      size={26}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.coverHint,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Add cover image
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.coverEdit,
                    { backgroundColor: "rgba(0,0,0,0.55)" },
                  ]}
                >
                  <Feather name="upload" size={12} color="#fff" />
                  <Text style={styles.coverEditText}>
                    {pickedUri ? "Replace" : "Upload"}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.presetRow}>
                {COVER_PRESETS.map((p) => {
                  const active = !pickedUri && coverKey === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => {
                        setPickedUri(null);
                        setCoverKey(p.key);
                      }}
                      style={[
                        styles.presetChip,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active
                            ? colors.primary + "15"
                            : colors.card,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          {
                            color: active
                              ? colors.primary
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Field label="Title" colors={colors}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Helix — autonomous lab for synthetic biology"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { color: colors.foreground }]}
                />
              </Field>

              <Field label="Summary" colors={colors}>
                <TextInput
                  value={summary}
                  onChangeText={setSummary}
                  placeholder="What you do, why now, traction so far…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[
                    styles.input,
                    styles.textarea,
                    { color: colors.foreground },
                  ]}
                />
              </Field>

              <Field label="Funding goal (Pi)" colors={colors}>
                <View style={styles.amountRow}>
                  <Text style={[styles.dollar, { color: colors.foreground }]}>
                    π
                  </Text>
                  <TextInput
                    value={raisingStr}
                    onChangeText={setRaisingStr}
                    placeholder="2,000,000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { color: colors.foreground, flex: 1 },
                    ]}
                  />
                  {raising > 0 && (
                    <Text
                      style={[
                        styles.amountHint,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {raising >= 1_000_000
                        ? `$${(raising / 1_000_000).toFixed(1)}M`
                        : `$${(raising / 1_000).toFixed(0)}K`}
                    </Text>
                  )}
                </View>
              </Field>

              <ChipPicker
                label="Stage"
                options={STAGES}
                value={stage}
                onChange={setStage}
                colors={colors}
              />

              <ChipPicker
                label="Industry"
                options={INDUSTRIES}
                value={industry}
                onChange={setIndustry}
                colors={colors}
              />

              <ChipPicker
                label="City"
                options={CITIES.map((c) => c.name)}
                value={cityName}
                onChange={setCityName}
                colors={colors}
              />

              {error && (
                <Text style={[styles.error, { color: "#ef4444" }]}>
                  {error}
                </Text>
              )}
            </ScrollView>

            <View
              style={[
                styles.footer,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Pressable
                disabled={!canSubmit}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitBtn,
                  {
                    backgroundColor: canSubmit
                      ? colors.primary
                      : colors.cardElevated,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {create.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather
                      name="zap"
                      size={14}
                      color={
                        canSubmit
                          ? colors.primaryForeground
                          : colors.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        styles.submitText,
                        {
                          color: canSubmit
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      Publish to Hub
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View
        style={[
          styles.fieldBody,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ChipPicker({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 12, 8, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  iconClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
  },
  coverImg: { width: "100%", height: "100%" },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 8,
  },
  coverHint: { fontSize: 12, fontFamily: "Inter_500Medium" },
  coverEdit: {
    position: "absolute",
    right: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coverEditText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  fieldBody: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 12,
    minHeight: 44,
  },
  textarea: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dollar: { fontSize: 18, fontFamily: "Inter_700Bold" },
  amountHint: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  error: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    marginBottom: 8,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
  },
  submitBtn: {
    height: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
