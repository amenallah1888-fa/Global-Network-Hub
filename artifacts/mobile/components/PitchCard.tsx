import { Feather } from "@expo/vector-icons";
import {
  getListPitchesQueryKey,
} from "@workspace/api-client-react";
import type { Pitch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { getImage } from "@/lib/imageMap";
import { useCurrentUserId, useUserById } from "@/lib/userCache";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function formatPi(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M π";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K π";
  return n + " π";
}

type OfferType = "donation" | "investment";

function InvestmentOfferModal({
  visible,
  pitchId,
  pitchTitle,
  onClose,
  onSent,
}: {
  visible: boolean;
  pitchId: string;
  pitchTitle: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const colors = useColors();
  const { token } = useAuth();
  const [offerType, setOfferType] = useState<OfferType>("donation");
  const [amountPi, setAmountPi] = useState("");
  const [equityPct, setEquityPct] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const reset = () => {
    setOfferType("donation");
    setAmountPi(""); setEquityPct(""); setMessage("");
    setError(""); setSending(false); setSent(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSend = async () => {
    if (!amountPi || parseInt(amountPi, 10) <= 0) {
      setError("Please enter a valid amount in Pi."); return;
    }
    if (offerType === "investment" && (!equityPct || parseInt(equityPct, 10) <= 0)) {
      setError("Please specify the equity percentage you're requesting."); return;
    }
    setError(""); setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/pitches/${pitchId}/proposals`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: offerType,
          amountPi: parseInt(amountPi, 10),
          equityPct: offerType === "investment" ? parseInt(equityPct, 10) : 0,
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to send offer.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={modal.backdrop}>
        <Pressable style={modal.overlay} onPress={handleClose} />
        <View style={[modal.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={modal.handle} />

          {sent ? (
            <View style={modal.sentWrap}>
              <View style={[modal.sentIcon, { backgroundColor: "#22C55E20" }]}>
                <Feather name="check-circle" size={40} color="#22C55E" />
              </View>
              <Text style={[modal.sentTitle, { color: colors.foreground }]}>Offer Sent!</Text>
              <Text style={[modal.sentSub, { color: colors.mutedForeground }]}>
                The founder will review your offer and respond shortly. You'll receive a notification when they accept or decline.
              </Text>
              <Pressable
                onPress={() => { reset(); onSent(); }}
                style={({ pressed }) => [modal.doneBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[modal.doneBtnText, { color: colors.primaryForeground }]}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[modal.title, { color: colors.foreground }]}>Send an Offer</Text>
              <Text style={[modal.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                to "{pitchTitle}"
              </Text>

              <View style={modal.typeRow}>
                <Pressable
                  onPress={() => setOfferType("donation")}
                  style={({ pressed }) => [modal.typeChip, {
                    backgroundColor: offerType === "donation" ? "#22C55E" : colors.background,
                    borderColor: offerType === "donation" ? "#22C55E" : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <Feather name="heart" size={14} color={offerType === "donation" ? "#fff" : colors.foreground} />
                  <Text style={[modal.typeChipText, { color: offerType === "donation" ? "#fff" : colors.foreground }]}>
                    Donation
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setOfferType("investment")}
                  style={({ pressed }) => [modal.typeChip, {
                    backgroundColor: offerType === "investment" ? colors.primary : colors.background,
                    borderColor: offerType === "investment" ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <Feather name="trending-up" size={14} color={offerType === "investment" ? colors.primaryForeground : colors.foreground} />
                  <Text style={[modal.typeChipText, { color: offerType === "investment" ? colors.primaryForeground : colors.foreground }]}>
                    Investment
                  </Text>
                </Pressable>
              </View>

              {offerType === "donation" ? (
                <View style={[modal.infoBox, { backgroundColor: "#22C55E12", borderColor: "#22C55E40" }]}>
                  <Feather name="info" size={12} color="#22C55E" />
                  <Text style={[modal.infoText, { color: "#22C55E" }]}>
                    No equity. You're supporting this project with Pi — a pure contribution.
                  </Text>
                </View>
              ) : (
                <View style={[modal.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
                  <Feather name="info" size={12} color={colors.primary} />
                  <Text style={[modal.infoText, { color: colors.primary }]}>
                    You invest Pi in exchange for an equity stake. The founder must accept your terms.
                  </Text>
                </View>
              )}

              <View style={modal.fieldWrap}>
                <Text style={[modal.label, { color: colors.mutedForeground }]}>Amount in Pi (π) *</Text>
                <View style={[modal.inputRow2, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[modal.piPrefix, { color: colors.primary }]}>π</Text>
                  <TextInput
                    value={amountPi}
                    onChangeText={setAmountPi}
                    placeholder="e.g. 1000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    style={[modal.input, { color: colors.foreground, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                  />
                </View>
              </View>

              {offerType === "investment" && (
                <View style={modal.fieldWrap}>
                  <Text style={[modal.label, { color: colors.mutedForeground }]}>Equity % Requested *</Text>
                  <View style={[modal.inputRow2, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TextInput
                      value={equityPct}
                      onChangeText={setEquityPct}
                      placeholder="e.g. 5"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="numeric"
                      style={[modal.input, { color: colors.foreground, flex: 1, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
                    />
                    <Text style={[modal.piPrefix, { color: colors.primary }]}>%</Text>
                  </View>
                </View>
              )}

              <View style={modal.fieldWrap}>
                <Text style={[modal.label, { color: colors.mutedForeground }]}>Message to Founder</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell them why you believe in this project…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[modal.textarea, {
                    color: colors.foreground,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
                  }]}
                />
              </View>

              {error ? (
                <View style={[modal.errorBox, { backgroundColor: "#EF444415", borderColor: "#EF4444" }]}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={[modal.errorText, { color: "#EF4444" }]}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSend}
                disabled={sending}
                style={({ pressed }) => [modal.sendBtn, {
                  backgroundColor: offerType === "investment" ? colors.primary : "#22C55E",
                  opacity: pressed || sending ? 0.75 : 1,
                }]}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="send" size={15} color="#fff" />
                      <Text style={modal.sendBtnText}>
                        Send {offerType === "investment" ? "Investment Offer" : "Donation"}
                      </Text>
                    </View>
                  )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function PitchCard({ pitch }: { pitch: Pitch }) {
  const colors = useColors();
  const currentUserId = useCurrentUserId();
  const founder = useUserById(pitch.founderId);
  const queryClient = useQueryClient();
  const pct = Math.min(100, Math.round((pitch.raised / pitch.raising) * 100));
  const cover = getImage(pitch.coverKey);
  const [offerOpen, setOfferOpen] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Avatar avatarKey={founder.avatarKey} size={36} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[styles.founder, { color: colors.foreground }]} numberOfLines={1}>{founder.name}</Text>
            <Text style={[styles.location, { color: colors.mutedForeground }]} numberOfLines={1}>
              {founder.title} · {pitch.city}
            </Text>
          </View>
        </View>
        {pitch.trending ? (
          <View style={[styles.trending, { backgroundColor: colors.primary + "1F", borderColor: colors.primary }]}>
            <Feather name="trending-up" size={11} color={colors.primary} />
            <Text style={[styles.trendingText, { color: colors.primary }]}>Trending</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>{pitch.title}</Text>
      <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={3}>{pitch.summary}</Text>

      {cover ? <Image source={cover} style={styles.cover} resizeMode="cover" /> : null}

      <View style={styles.tagsRow}>
        <Tag label={pitch.stage} colors={colors} accent={colors.accent} />
        <Tag label={pitch.industry} colors={colors} />
        <Tag label={`${pitch.backersCount} backers`} colors={colors} />
      </View>

      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.amountRow}>
            <Text style={[styles.raised, { color: colors.foreground }]}>{formatPi(pitch.raised)}</Text>
            <Text style={[styles.raising, { color: colors.mutedForeground }]}>of {formatPi(pitch.raising)}</Text>
          </View>
          <View style={[styles.bar, { backgroundColor: colors.cardElevated }]}>
            <View
              style={[styles.barFill, { backgroundColor: pct >= 100 ? colors.success : colors.primary, width: `${pct}%` }]}
            />
          </View>
          <Text style={[styles.pct, { color: colors.mutedForeground }]}>{pct}% committed</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {pitch.founderId !== currentUserId ? (
          <Pressable
            onPress={() => router.push(`/chat/${pitch.founderId}`)}
            style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="message-circle" size={14} color={colors.foreground} />
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>Contact</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="eye" size={14} color={colors.foreground} />
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>Memo</Text>
          </Pressable>
        )}

        {pitch.founderId !== currentUserId && (
          <Pressable
            disabled={pitch.backed}
            onPress={() => setOfferOpen(true)}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: pitch.backed ? colors.success : colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name={pitch.backed ? "check" : "briefcase"} size={14} color={colors.primaryForeground} />
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
              {pitch.backed ? "Offered" : "Express Interest"}
            </Text>
          </Pressable>
        )}
      </View>

      <InvestmentOfferModal
        visible={offerOpen}
        pitchId={pitch.id}
        pitchTitle={pitch.title}
        onClose={() => setOfferOpen(false)}
        onSent={() => {
          setOfferOpen(false);
          queryClient.invalidateQueries({ queryKey: getListPitchesQueryKey() });
        }}
      />
    </View>
  );
}

function Tag({ label, colors, accent }: { label: string; colors: ReturnType<typeof useColors>; accent?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: accent ? accent + "20" : colors.cardElevated, borderColor: accent ?? colors.border }]}>
      <Text style={[styles.tagText, { color: accent ?? colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 14 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  founder: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  location: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  trending: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  trendingText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4, textTransform: "uppercase" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3, marginTop: 14, lineHeight: 24 },
  summary: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginTop: 6 },
  cover: { width: "100%", height: 130, borderRadius: 14, marginTop: 12 },
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 14, flexWrap: "wrap" },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  progressRow: { flexDirection: "row", marginTop: 16 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 8 },
  raised: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  raising: { fontSize: 12, fontFamily: "Inter_500Medium" },
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  pct: { marginTop: 6, fontSize: 11, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  secondaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  primaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const modal = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 200 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, padding: 24, paddingTop: 16, maxHeight: "88%", gap: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6, marginBottom: 4 },
  typeRow: { flexDirection: "row", gap: 10, marginVertical: 4 },
  typeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  typeChipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 17 },
  fieldWrap: { gap: 6, marginBottom: 2 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  inputRow2: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  piPrefix: { fontSize: 18, fontFamily: "Inter_700Bold", paddingRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  sendBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 6, marginBottom: 20 },
  sendBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  sentWrap: { alignItems: "center", padding: 16, gap: 12 },
  sentIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  sentTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  sentSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  doneBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8, marginBottom: 16 },
  doneBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
