import { Feather } from "@expo/vector-icons";
import { useListCircles } from "@workspace/api-client-react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CircleCard } from "@/components/CircleCard";
import { Header } from "@/components/Header";
import { SegmentControl } from "@/components/SegmentControl";
import { useColors } from "@/hooks/useColors";

const SEGMENTS = ["Discover", "Joined", "Paid"];

function CreateCircleSheet({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  if (!visible) return null;

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Give your circle a name.");
      return;
    }
    Alert.alert(
      "Circle created!",
      `"${name.trim()}" has been created. Full circle creation will be connected to the backend in the next update.`,
      [{ text: "OK", onPress: onClose }],
    );
    setName("");
    setDesc("");
    setIsPaid(false);
  };

  return (
    <View style={[sheet.backdrop]}>
      <Pressable style={sheet.overlay} onPress={onClose} />
      <View
        style={[
          sheet.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={sheet.handle} />
        <Text style={[sheet.title, { color: colors.foreground }]}>
          Start a Circle
        </Text>
        <Text style={[sheet.subtitle, { color: colors.mutedForeground }]}>
          Create an invite-only or paid community
        </Text>

        <View style={sheet.fieldWrap}>
          <Text style={[sheet.label, { color: colors.mutedForeground }]}>
            Circle Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Founders in Stealth"
            placeholderTextColor={colors.mutedForeground}
            style={[
              sheet.input,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
        </View>

        <View style={sheet.fieldWrap}>
          <Text style={[sheet.label, { color: colors.mutedForeground }]}>
            Description (optional)
          </Text>
          <TextInput
            value={desc}
            onChangeText={setDesc}
            placeholder="What's this circle about?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              sheet.input,
              sheet.textarea,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
        </View>

        <View style={sheet.typeRow}>
          <Pressable
            onPress={() => setIsPaid(false)}
            style={[
              sheet.typeChip,
              {
                backgroundColor: !isPaid ? colors.primary : colors.background,
                borderColor: !isPaid ? colors.primary : colors.border,
              },
            ]}
          >
            <Feather
              name="lock"
              size={13}
              color={!isPaid ? colors.primaryForeground : colors.foreground}
            />
            <Text
              style={[
                sheet.typeText,
                { color: !isPaid ? colors.primaryForeground : colors.foreground },
              ]}
            >
              Invite-only
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsPaid(true)}
            style={[
              sheet.typeChip,
              {
                backgroundColor: isPaid ? colors.primary : colors.background,
                borderColor: isPaid ? colors.primary : colors.border,
              },
            ]}
          >
            <Feather
              name="dollar-sign"
              size={13}
              color={isPaid ? colors.primaryForeground : colors.foreground}
            />
            <Text
              style={[
                sheet.typeText,
                { color: isPaid ? colors.primaryForeground : colors.foreground },
              ]}
            >
              Paid
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleCreate}
          style={({ pressed }) => [
            sheet.createBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[sheet.createText, { color: colors.primaryForeground }]}>
            Create Circle
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CirclesScreen() {
  const colors = useColors();
  const [segment, setSegment] = useState("Discover");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: circles, isLoading } = useListCircles();

  const list = circles ?? [];
  const visible = useMemo(() => {
    if (segment === "Joined") return list.filter((c) => c.joined);
    if (segment === "Paid") return list.filter((c) => c.paid);
    return list;
  }, [list, segment]);

  const totalActive = list.reduce(
    (sum, c) => sum + (c.joined ? c.activeNow : 0),
    0,
  );
  const monthly = list
    .filter((c) => c.joined && c.paid)
    .reduce((s, c) => s + (c.price ?? 0), 0);
  const memberships = list.filter((c) => c.joined).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Circles"
        subtitle="Your private rooms & paid groups"
        rightIcon="plus"
        onRightPress={() => setCreateOpen(true)}
      />
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CircleCard circle={item} />}
        ListHeaderComponent={
          <View>
            <Pressable
              onPress={() => setCreateOpen(true)}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[styles.ctaIcon, { backgroundColor: colors.primary + "1F" }]}
              >
                <Feather name="users" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
                  Start a Circle
                </Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
                  Invite-only or paid. You set the bar.
                </Text>
              </View>
              <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
            </Pressable>

            <View style={styles.statsRow}>
              <View
                style={[
                  styles.stat,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {memberships}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Memberships
                </Text>
              </View>
              <View
                style={[
                  styles.stat,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {totalActive}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Active now
                </Text>
              </View>
              <View
                style={[
                  styles.stat,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.tip }]}>
                  ${monthly}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Monthly
                </Text>
              </View>
            </View>

            <View style={{ paddingVertical: 6 }}>
              <SegmentControl
                options={SEGMENTS}
                value={segment}
                onChange={setSegment}
              />
            </View>
            <View style={{ height: 12 }} />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="users" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No circles here yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {segment === "Joined"
                  ? "Join one from Discover to see it here."
                  : segment === "Paid"
                    ? "Premium circles will appear here."
                    : "New rooms open every week."}
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />

      <CreateCircleSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cta: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  ctaSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});

const sheet = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingTop: 16,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  createBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  createText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
