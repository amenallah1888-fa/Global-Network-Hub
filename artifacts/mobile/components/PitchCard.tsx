import { Feather } from "@expo/vector-icons";
import {
  getListPitchesQueryKey,
} from "@workspace/api-client-react";
import type { Pitch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

function MemoModal({ visible, pitchId, pitchTitle, onClose }: { visible: boolean; pitchId: string; pitchTitle: string; onClose: () => void }) {
  const colors = useColors();
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/pitches/${pitchId}/memo`],
    queryFn: async () => {
      const [pitchRes, docsRes] = await Promise.all([
        fetch(`${API_BASE}/api/pitches/${pitchId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/pitches/${pitchId}/documents`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const pitch = pitchRes.ok ? await pitchRes.json() : null;
      const docs = docsRes.ok ? await docsRes.json() : [];
      return { pitch, docs };
    },
    enabled: visible && !!token,
    staleTime: 30_000,
  });

  const pitch = data?.pitch;
  const docs: any[] = data?.docs ?? [];
  const approvals: Record<string, string> = pitch?.validatorApprovals ?? {};
  const approvedCount = Object.values(approvals).filter(v => v === "approve").length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={memo.backdrop}>
        <Pressable style={memo.overlay} onPress={onClose} />
        <View style={[memo.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={memo.handle} />
          <View style={[memo.header, { borderBottomColor: colors.border }]}>
            <View style={[memo.iconWrap, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="file-text" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[memo.title, { color: colors.foreground }]} numberOfLines={1}>{pitchTitle}</Text>
              <Text style={[memo.subtitle, { color: colors.mutedForeground }]}>Project Memo</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={memo.center}><ActivityIndicator color={colors.primary} /></View>
          ) : isError || !pitch ? (
            <View style={memo.center}><Text style={[memo.errorText, { color: colors.mutedForeground }]}>Could not load memo.</Text></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
              <View style={[memo.trustBar, { backgroundColor: colors.cardElevated }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[memo.trustLabel, { color: colors.mutedForeground }]}>TRUST SCORE</Text>
                  <Text style={[memo.trustValue, { color: pitch.trustScore >= 70 ? colors.success : pitch.trustScore >= 40 ? colors.tip : colors.foreground }]}>
                    {pitch.trustScore ?? 0}%
                  </Text>
                </View>
                <View style={[memo.trustFillWrap, { backgroundColor: colors.border }]}>
                  <View style={[memo.trustFill, {
                    width: `${pitch.trustScore ?? 0}%` as any,
                    backgroundColor: pitch.trustScore >= 70 ? colors.success : pitch.trustScore >= 40 ? colors.tip : "#EF4444",
                  }]} />
                </View>
                <Text style={[memo.validatorNote, { color: colors.mutedForeground }]}>{approvedCount}/4 approved</Text>
              </View>

              <View style={[memo.section, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[memo.sectionLabel, { color: colors.mutedForeground }]}>SUMMARY</Text>
                <Text style={[memo.bodyText, { color: colors.foreground }]}>{pitch.summary}</Text>
              </View>

              <View style={[memo.section, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[memo.sectionLabel, { color: colors.mutedForeground }]}>VALIDATOR APPROVALS</Text>
                {(["identity", "reality", "roadmap", "portfolio"] as const).map((block) => {
                  const state = approvals[block];
                  const icon: any = state === "approve" ? "check-circle" : state === "reject" ? "x-circle" : "circle";
                  const col = state === "approve" ? colors.success : state === "reject" ? "#EF4444" : colors.mutedForeground;
                  const labels: Record<string, string> = { identity: "Identity Review", reality: "Proof of Reality", roadmap: "Roadmap / Vision", portfolio: "Portfolio / Experience" };
                  return (
                    <View key={block} style={[memo.blockRow, { borderTopColor: colors.border }]}>
                      <Feather name={icon} size={15} color={col} />
                      <Text style={[memo.blockLabel, { color: colors.foreground }]}>{labels[block]}</Text>
                      <Text style={[memo.blockState, { color: col }]}>{state === "approve" ? "+25%" : state === "reject" ? "Rejected" : "Pending"}</Text>
                    </View>
                  );
                })}
              </View>

              {docs.length > 0 && (
                <View style={[memo.section, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[memo.sectionLabel, { color: colors.mutedForeground }]}>SUBMITTED DOCUMENTS</Text>
                  {docs.map((doc: any) => (
                    <View key={doc.id} style={[memo.docRow, { borderTopColor: colors.border }]}>
                      <Feather name="link" size={13} color={colors.primary} />
                      <Text style={[memo.docType, { color: colors.mutedForeground }]}>{doc.documentType}</Text>
                      <Text style={[memo.docStatus, { color: doc.status === "APPROVED" ? colors.success : colors.mutedForeground }]}>{doc.status}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={[memo.metaRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {[
                  { label: "Stage", value: pitch.stage },
                  { label: "Industry", value: pitch.industry },
                  { label: "City", value: pitch.city },
                ].map((item) => (
                  <View key={item.label} style={memo.metaItem}>
                    <Text style={[memo.metaLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                    <Text style={[memo.metaValue, { color: colors.foreground }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
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
  const [memoOpen, setMemoOpen] = useState(false);

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
            onPress={() => setMemoOpen(true)}
            style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="file-text" size={14} color={colors.foreground} />
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
      <MemoModal
        visible={memoOpen}
        pitchId={pitch.id}
        pitchTitle={pitch.title}
        onClose={() => setMemoOpen(false)}
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

const memo = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 300 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, maxHeight: "90%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  subtitle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  center: { height: 140, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  trustBar: { borderRadius: 16, padding: 16, gap: 8 },
  trustLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  trustValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  trustFillWrap: { height: 6, borderRadius: 3, overflow: "hidden" },
  trustFill: { height: "100%", borderRadius: 3 },
  validatorNote: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  section: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  bodyText: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  blockRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  blockLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  blockState: { fontSize: 12, fontFamily: "Inter_700Bold" },
  docRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  docType: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  docStatus: { fontSize: 11, fontFamily: "Inter_700Bold" },
  metaRow: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row" },
  metaItem: { flex: 1, alignItems: "center" },
  metaLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  metaValue: { fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 3 },
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
