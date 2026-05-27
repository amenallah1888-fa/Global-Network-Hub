import { Feather } from "@expo/vector-icons";
import { useListCircles } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { CircleCard } from "@/components/CircleCard";
import { Header } from "@/components/Header";
import { SegmentControl } from "@/components/SegmentControl";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const SEGMENTS = ["Discover", "Joined", "Paid"];
const CATEGORIES = ["Technology", "Finance", "Services", "Education", "Arts", "General"];

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function CreateCircleSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const colors = useColors();
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [rules, setRules] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState("Technology");
  const [isPaid, setIsPaid] = useState(false);
  const [isInviteOnly, setIsInviteOnly] = useState(true);
  const [entryFee, setEntryFee] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);

  const reset = () => {
    setName(""); setAbout(""); setRules(""); setCoverUrl("");
    setCategory("Technology"); setIsPaid(false); setIsInviteOnly(true);
    setEntryFee(""); setError(""); setCreating(false); setShowCatPicker(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Circle name is required."); return; }
    if (!about.trim()) { setError("A short description is required."); return; }
    if (isPaid && (!entryFee || parseInt(entryFee, 10) <= 0)) {
      setError("Entry fee must be greater than 0 for paid circles.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/circles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          about: about.trim(),
          category,
          rules: rules.trim() || null,
          coverUrl: coverUrl.trim() || null,
          paid: isPaid,
          inviteOnly: isInviteOnly || isPaid,
          price: isPaid ? parseInt(entryFee, 10) : 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create circle.");
        return;
      }
      const data = await res.json();
      reset();
      onCreated(data.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={sheet.backdrop}>
      <Pressable style={sheet.overlay} onPress={handleClose} />
      <View style={[sheet.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={sheet.handle} />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          <Text style={[sheet.title, { color: colors.foreground }]}>Start a Circle</Text>
          <Text style={[sheet.subtitle, { color: colors.mutedForeground }]}>
            Create a private or paid community
          </Text>

          <View style={sheet.fieldWrap}>
            <Text style={[sheet.label, { color: colors.mutedForeground }]}>Circle Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Founders in Stealth"
              placeholderTextColor={colors.mutedForeground}
              style={[sheet.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
          </View>

          <View style={sheet.fieldWrap}>
            <Text style={[sheet.label, { color: colors.mutedForeground }]}>Description *</Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="What's this circle about?"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[sheet.input, sheet.textarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
          </View>

          <View style={sheet.fieldWrap}>
            <Text style={[sheet.label, { color: colors.mutedForeground }]}>Category</Text>
            <Pressable
              onPress={() => setShowCatPicker(true)}
              style={[sheet.input, sheet.pickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <Text style={[{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" }]}>{category}</Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={sheet.fieldWrap}>
            <Text style={[sheet.label, { color: colors.mutedForeground }]}>Circle Rules</Text>
            <TextInput
              value={rules}
              onChangeText={setRules}
              placeholder="Set expectations for members (optional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[sheet.input, sheet.textarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
          </View>

          <View style={sheet.fieldWrap}>
            <Text style={[sheet.label, { color: colors.mutedForeground }]}>Cover Image URL</Text>
            <TextInput
              value={coverUrl}
              onChangeText={setCoverUrl}
              placeholder="https://… (optional)"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="url"
              style={[sheet.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
          </View>

          <View style={sheet.typeRow}>
            <Pressable
              onPress={() => { setIsInviteOnly(true); setIsPaid(false); }}
              style={[sheet.typeChip, {
                backgroundColor: isInviteOnly && !isPaid ? colors.primary : colors.background,
                borderColor: isInviteOnly && !isPaid ? colors.primary : colors.border,
              }]}
            >
              <Feather name="lock" size={13} color={isInviteOnly && !isPaid ? colors.primaryForeground : colors.foreground} />
              <Text style={[sheet.typeText, { color: isInviteOnly && !isPaid ? colors.primaryForeground : colors.foreground }]}>
                Invite-only
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setIsPaid(true); setIsInviteOnly(true); }}
              style={[sheet.typeChip, {
                backgroundColor: isPaid ? colors.primary : colors.background,
                borderColor: isPaid ? colors.primary : colors.border,
              }]}
            >
              <Text style={{ fontSize: 13, color: isPaid ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" }}>π</Text>
              <Text style={[sheet.typeText, { color: isPaid ? colors.primaryForeground : colors.foreground }]}>Paid</Text>
            </Pressable>
          </View>

          {isInviteOnly && !isPaid && (
            <View style={[sheet.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
              <Feather name="info" size={13} color={colors.primary} />
              <Text style={[sheet.infoText, { color: colors.primary }]}>
                Only you can approve new members
              </Text>
            </View>
          )}

          {isPaid && (
            <View style={sheet.fieldWrap}>
              <Text style={[sheet.label, { color: colors.mutedForeground }]}>Entry Fee (in Pi) *</Text>
              <TextInput
                value={entryFee}
                onChangeText={setEntryFee}
                placeholder="e.g. 10"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                style={[sheet.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
              <Text style={[sheet.hint, { color: colors.mutedForeground }]}>
                Members pay this fee to join. Collected into your Circle Pool.
              </Text>
            </View>
          )}

          {error ? (
            <View style={[sheet.errorBox, { backgroundColor: "#EF4444" + "15", borderColor: "#EF4444" }]}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={[sheet.errorText, { color: "#EF4444" }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleCreate}
            disabled={creating}
            style={({ pressed }) => [sheet.createBtn, { backgroundColor: colors.primary, opacity: pressed || creating ? 0.75 : 1 }]}
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[sheet.createText, { color: colors.primaryForeground }]}>Start Circle</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>

      <Modal visible={showCatPicker} transparent animationType="fade" onRequestClose={() => setShowCatPicker(false)}>
        <Pressable style={sheet.catOverlay} onPress={() => setShowCatPicker(false)}>
          <View style={[sheet.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => { setCategory(cat); setShowCatPicker(false); }}
                style={({ pressed }) => [sheet.catItem, {
                  backgroundColor: cat === category ? colors.primary + "15" : "transparent",
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={[sheet.catItemText, { color: cat === category ? colors.primary : colors.foreground }]}>{cat}</Text>
                {cat === category && <Feather name="check" size={15} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function CirclesScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const [segment, setSegment] = useState("Discover");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: circles, isLoading } = useListCircles();

  const list = circles ?? [];
  const visible = useMemo(() => {
    if (segment === "Joined") return list.filter((c) => c.joined);
    if (segment === "Paid") return list.filter((c) => c.paid);
    return list;
  }, [list, segment]);

  const totalActive = list.reduce((sum, c) => sum + (c.joined ? c.activeNow : 0), 0);
  const monthly = list.filter((c) => c.joined && c.paid).reduce((s, c) => s + (c.price ?? 0), 0);
  const memberships = list.filter((c) => c.joined).length;

  const handleCreated = (id: string) => {
    setCreateOpen(false);
    qc.invalidateQueries({ queryKey: ["/api/circles"] });
    router.push(`/circle/${id}`);
  };

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
              style={({ pressed }) => [styles.cta, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
            >
              <View style={[styles.ctaIcon, { backgroundColor: colors.primary + "1F" }]}>
                <Feather name="users" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Start a Circle</Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>Invite-only or paid. You set the bar.</Text>
              </View>
              <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
            </Pressable>

            <View style={styles.statsRow}>
              <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{memberships}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Memberships</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{totalActive}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active now</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.tip }]}>${monthly}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Monthly</Text>
              </View>
            </View>

            <View style={{ paddingVertical: 6 }}>
              <SegmentControl options={SEGMENTS} value={segment} onChange={setSegment} />
            </View>
            <View style={{ height: 12 }} />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.empty}>
              <Feather name="users" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No circles here yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {segment === "Joined" ? "Join one from Discover to see it here."
                  : segment === "Paid" ? "Premium circles will appear here."
                  : "Be the first to start a circle."}
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
        onCreated={handleCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cta: { marginHorizontal: 16, marginTop: 14, padding: 16, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  ctaTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  ctaSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 14, marginBottom: 14 },
  stat: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});

const sheet = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 100 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, padding: 24, paddingTop: 16, maxHeight: "92%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.4, marginBottom: 2 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  fieldWrap: { gap: 8, marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeRow: { flexDirection: "row", gap: 10, marginVertical: 8 },
  typeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  typeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  createBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16, marginBottom: 8 },
  createText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  catOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 32 },
  catCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  catItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 },
  catItemText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
