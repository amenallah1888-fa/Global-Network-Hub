import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type ServiceDetail = {
  id: string;
  title: string;
  category: string;
  description: string;
  pricePi: number;
  rating: number;
  trustScore: number;
  city?: string;
  country?: string;
  hiredCount: number;
  portfolioUrl?: string;
  createdAt: string;
  provider: {
    id: string; name: string; handle: string; avatarKey: string | null; verified: boolean;
    city: string; country: string; bio: string; title: string; company: string; followersCount: number;
  } | null;
  related: ServiceDetail[];
};

const CAT_COLORS: Record<string, string> = {
  Development: "#6366F1", Design: "#EC4899", Marketing: "#F59E0B",
  Logistics: "#10B981", Legal: "#8B5CF6", Copywriting: "#0EA5E9", Finance: "#14B8A6",
};

type EscrowStage = "review" | "amount" | "confirm" | "success";

function EscrowModal({ service, visible, onClose }: {
  service: ServiceDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { token } = useAuth();
  const [stage, setStage] = useState<EscrowStage>("review");
  const [amount, setAmount] = useState(service.pricePi > 0 ? String(service.pricePi) : "");
  const [scope, setScope] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setStage("review"); setAmount(service.pricePi > 0 ? String(service.pricePi) : ""); setScope(""); setError(""); };

  const handleHire = async () => {
    const amt = parseInt(amount, 10);
    if (!scope.trim()) { setError("Please describe the scope of work"); return; }
    if (!amt || amt <= 0) { setError("Enter a valid Pi amount"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/smart-agreements`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: service.id,
          totalPiCommitted: amt,
          milestones: [{ title: "Service Delivery", description: scope, percentage: 100 }],
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create escrow agreement");
        return;
      }
      await fetch(`${API_BASE}/api/services/${service.id}/hire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStage("success");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const STAGES: EscrowStage[] = ["review", "amount", "confirm", "success"];
  const stageIdx = STAGES.indexOf(stage);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={em.backdrop}>
        <View style={[em.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[em.header, { borderBottomColor: colors.border }]}>
            <Text style={[em.headerTitle, { color: colors.foreground }]}>
              {stage === "success" ? "Contract Created" : "Hire with Pi Escrow"}
            </Text>
            <Pressable onPress={() => { reset(); onClose(); }} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {stage !== "success" && (
            <View style={em.stageRow}>
              {["Review", "Amount", "Confirm"].map((s, i) => (
                <View key={s} style={em.stageItem}>
                  <View style={[em.stageDot, {
                    backgroundColor: i <= stageIdx ? colors.primary : colors.cardElevated,
                    borderColor: i <= stageIdx ? colors.primary : colors.border,
                  }]}>
                    {i < stageIdx
                      ? <Feather name="check" size={10} color="#fff" />
                      : <Text style={[em.stageDotText, { color: i <= stageIdx ? "#fff" : colors.mutedForeground }]}>{i + 1}</Text>}
                  </View>
                  <Text style={[em.stageLabel, { color: i <= stageIdx ? colors.primary : colors.mutedForeground }]}>{s}</Text>
                  {i < 2 && <View style={[em.stageLine, { backgroundColor: i < stageIdx ? colors.primary : colors.border }]} />}
                </View>
              ))}
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {stage === "review" && (
              <>
                <View style={[em.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                  <Feather name="shield" size={14} color={colors.primary} />
                  <Text style={[em.infoText, { color: colors.primary }]}>
                    Funds are held in secure Pi Escrow. Released only when you confirm delivery.
                  </Text>
                </View>
                <View style={em.serviceRow}>
                  <Avatar avatarKey={service.provider?.avatarKey ?? null} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={[em.serviceTitle, { color: colors.foreground }]}>{service.title}</Text>
                    <Text style={[em.serviceProv, { color: colors.mutedForeground }]}>by {service.provider?.name ?? "Provider"}</Text>
                  </View>
                </View>
                <View style={[em.termsBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[em.termsTitle, { color: colors.foreground }]}>Escrow Terms</Text>
                  {[
                    "Funds locked until work is verified",
                    "Provider submits proof on completion",
                    "30-day automatic refund if no delivery",
                    "AML velocity checks active",
                    "Immutable audit trail recorded",
                  ].map((t) => (
                    <View key={t} style={em.termRow}>
                      <Feather name="check" size={12} color={colors.success} />
                      <Text style={[em.termText, { color: colors.foreground }]}>{t}</Text>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => setStage("amount")} style={({ pressed }) => [em.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={em.btnText}>Continue</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </Pressable>
              </>
            )}

            {stage === "amount" && (
              <>
                <Text style={[em.fieldLabel, { color: colors.mutedForeground }]}>Pi Amount to Commit</Text>
                <View style={[em.amountRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[em.piSymbol, { color: colors.primary }]}>π</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    style={[em.amountInput, { color: colors.foreground }]}
                  />
                </View>
                <Text style={[em.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Scope of Work</Text>
                <TextInput
                  value={scope}
                  onChangeText={setScope}
                  placeholder="Describe exactly what you need delivered…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[em.scopeInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                {error ? <Text style={[em.errorText, { color: "#EF4444" }]}>{error}</Text> : null}
                <Pressable onPress={() => { if (!amount || parseInt(amount, 10) <= 0) { setError("Enter a valid amount"); return; } if (!scope.trim()) { setError("Describe the scope"); return; } setError(""); setStage("confirm"); }}
                  style={({ pressed }) => [em.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={em.btnText}>Review Contract</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </Pressable>
              </>
            )}

            {stage === "confirm" && (
              <>
                <View style={[em.confirmCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[em.confirmTitle, { color: colors.foreground }]}>Smart Contract Summary</Text>
                  <View style={em.confirmRow}>
                    <Text style={[em.confirmLabel, { color: colors.mutedForeground }]}>Service</Text>
                    <Text style={[em.confirmValue, { color: colors.foreground }]}>{service.title}</Text>
                  </View>
                  <View style={em.confirmRow}>
                    <Text style={[em.confirmLabel, { color: colors.mutedForeground }]}>Provider</Text>
                    <Text style={[em.confirmValue, { color: colors.foreground }]}>{service.provider?.name}</Text>
                  </View>
                  <View style={em.confirmRow}>
                    <Text style={[em.confirmLabel, { color: colors.mutedForeground }]}>Amount</Text>
                    <Text style={[em.confirmValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{amount} π</Text>
                  </View>
                  <View style={[em.confirmRow, { borderTopWidth: 0 }]}>
                    <Text style={[em.confirmLabel, { color: colors.mutedForeground }]}>Scope</Text>
                    <Text style={[em.confirmValue, { color: colors.foreground, flexShrink: 1 }]} numberOfLines={3}>{scope}</Text>
                  </View>
                  <View style={[em.confirmRow, { borderBottomWidth: 0 }]}>
                    <Text style={[em.confirmLabel, { color: colors.mutedForeground }]}>Refund by</Text>
                    <Text style={[em.confirmValue, { color: colors.foreground }]}>{new Date(Date.now() + 30 * 86400000).toLocaleDateString()}</Text>
                  </View>
                </View>
                {error ? <Text style={[em.errorText, { color: "#EF4444" }]}>{error}</Text> : null}
                <Pressable onPress={handleHire} disabled={loading} style={({ pressed }) => [em.btn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.75 : 1 }]}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <>
                    <Feather name="lock" size={15} color="#fff" />
                    <Text style={em.btnText}>Lock Funds in Escrow</Text>
                  </>}
                </Pressable>
              </>
            )}

            {stage === "success" && (
              <View style={em.successWrap}>
                <View style={[em.successIcon, { backgroundColor: colors.success + "20" }]}>
                  <Feather name="check-circle" size={40} color={colors.success} />
                </View>
                <Text style={[em.successTitle, { color: colors.foreground }]}>Contract Locked!</Text>
                <Text style={[em.successSub, { color: colors.mutedForeground }]}>
                  Your {amount} π is securely held in escrow. The provider has been notified and will begin work shortly.
                </Text>
                <View style={[em.successBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="info" size={13} color={colors.mutedForeground} />
                  <Text style={[em.successNote, { color: colors.mutedForeground }]}>
                    Funds will be released when you verify delivery. Automatic refund if no delivery in 30 days.
                  </Text>
                </View>
                <Pressable onPress={() => { reset(); onClose(); }} style={({ pressed }) => [em.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={em.btnText}>Done</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DonateModal({ service, visible, onClose }: { service: ServiceDetail; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { token } = useAuth();
  const [amount, setAmount] = useState("5");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const handleDonate = async () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/services/${service.id}/hire`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setSuccess(true);
    } catch {} finally { setLoading(false); }
  };
  const reset = () => { setAmount("5"); setSuccess(false); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={em.backdrop}>
        <View style={[em.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[em.header, { borderBottomColor: colors.border }]}>
            <Text style={[em.headerTitle, { color: colors.foreground }]}>{success ? "Donation Sent!" : "Donate to Provider"}</Text>
            <Pressable onPress={() => { reset(); onClose(); }} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {success ? (
              <View style={em.successWrap}>
                <View style={[em.successIcon, { backgroundColor: "#EF444420" }]}><Feather name="heart" size={40} color="#EF4444" /></View>
                <Text style={[em.successTitle, { color: colors.foreground }]}>{amount} π Donated!</Text>
                <Text style={[em.successSub, { color: colors.mutedForeground }]}>Thank you for supporting this service provider directly.</Text>
                <Pressable onPress={() => { reset(); onClose(); }} style={({ pressed }) => [em.btn, { backgroundColor: "#EF4444", opacity: pressed ? 0.85 : 1 }]}><Text style={em.btnText}>Done</Text></Pressable>
              </View>
            ) : (
              <>
                <View style={[em.infoBox, { backgroundColor: "#EF444410", borderColor: "#EF444430" }]}>
                  <Feather name="heart" size={14} color="#EF4444" />
                  <Text style={[em.infoText, { color: "#EF4444" }]}>Donate directly to this provider — no escrow, no contract.</Text>
                </View>
                <Text style={[em.fieldLabel, { color: colors.mutedForeground }]}>Amount (π)</Text>
                <View style={[em.amountRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[em.piSymbol, { color: "#EF4444" }]}>π</Text>
                  <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.mutedForeground} style={[em.amountInput, { color: colors.foreground }]} />
                </View>
                <Pressable onPress={handleDonate} disabled={loading} style={({ pressed }) => [em.btn, { backgroundColor: "#EF4444", opacity: pressed || loading ? 0.75 : 1 }]}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <><Feather name="heart" size={15} color="#fff" /><Text style={em.btnText}>Donate {amount} π</Text></>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SendOfferModal({ service, visible, onClose }: { service: ServiceDetail; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { token } = useAuth();
  const [note, setNote] = useState("");
  const [amt, setAmt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const handleSend = async () => {
    if (!note.trim()) { setError("Describe your offer or proposal"); return; }
    setError(""); setLoading(true);
    try {
      await fetch(`${API_BASE}/api/services/${service.id}/hire`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setSent(true);
    } catch { setError("Could not send offer. Please try again."); } finally { setLoading(false); }
  };
  const reset = () => { setNote(""); setAmt(""); setSent(false); setError(""); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={em.backdrop}>
        <View style={[em.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[em.header, { borderBottomColor: colors.border }]}>
            <Text style={[em.headerTitle, { color: colors.foreground }]}>{sent ? "Offer Sent!" : "Send Offer"}</Text>
            <Pressable onPress={() => { reset(); onClose(); }} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {sent ? (
              <View style={em.successWrap}>
                <View style={[em.successIcon, { backgroundColor: colors.primary + "20" }]}><Feather name="send" size={40} color={colors.primary} /></View>
                <Text style={[em.successTitle, { color: colors.foreground }]}>Offer Delivered!</Text>
                <Text style={[em.successSub, { color: colors.mutedForeground }]}>The provider has been notified. They will reach out to discuss your project.</Text>
                <Pressable onPress={() => { reset(); onClose(); }} style={({ pressed }) => [em.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}><Text style={em.btnText}>Done</Text></Pressable>
              </View>
            ) : (
              <>
                <Text style={[em.fieldLabel, { color: colors.mutedForeground }]}>Your Proposal</Text>
                <TextInput value={note} onChangeText={setNote} placeholder="Describe your project, requirements, timeline…" placeholderTextColor={colors.mutedForeground} multiline style={[em.scopeInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                <Text style={[em.fieldLabel, { color: colors.mutedForeground }]}>Budget (π, optional)</Text>
                <View style={[em.amountRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[em.piSymbol, { color: colors.primary }]}>π</Text>
                  <TextInput value={amt} onChangeText={setAmt} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.mutedForeground} style={[em.amountInput, { color: colors.foreground }]} />
                </View>
                {error ? <Text style={[em.errorText, { color: "#EF4444" }]}>{error}</Text> : null}
                <Pressable onPress={handleSend} disabled={loading} style={({ pressed }) => [em.btn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.75 : 1 }]}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <><Feather name="send" size={15} color="#fff" /><Text style={em.btnText}>Send Offer</Text></>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [escrowOpen, setEscrowOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  const { data: service, isLoading, isError } = useQuery<ServiceDetail>({
    queryKey: [`/api/services/${id}`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/services/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id && !!token,
    staleTime: 30_000,
    retry: 1,
  });

  const catColor = service ? (CAT_COLORS[service.category] ?? colors.primary) : colors.primary;
  const stars = service ? Math.round(service.rating) : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { backgroundColor: colors.cardElevated }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>Service Detail</Text>
        <View style={{ width: 36 }} />
      </View>

      {isError ? (
        <View style={[styles.center, { gap: 12 }]}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={[styles.topTitle, { color: colors.mutedForeground, fontSize: 15 }]}>Service not found</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.primary, width: "auto", paddingHorizontal: 20 }]}>
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Go back</Text>
          </Pressable>
        </View>
      ) : isLoading || !service ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
            {/* Hero */}
            <View style={[styles.hero, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={styles.heroBadgeRow}>
                <View style={[styles.catBadge, { backgroundColor: catColor + "18", borderColor: catColor + "40" }]}>
                  <Text style={[styles.catText, { color: catColor }]}>{service.category}</Text>
                </View>
                {service.trustScore >= 70 && (
                  <View style={[styles.trustedBadge, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
                    <Feather name="shield" size={10} color={colors.success} />
                    <Text style={[styles.trustedText, { color: colors.success }]}>Trusted Provider</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>{service.title}</Text>
              <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>{service.description}</Text>

              <View style={styles.metaRow}>
                <View style={styles.ratingRow}>
                  {"★★★★★".split("").map((_, i) => (
                    <Text key={i} style={[styles.star, { color: i < stars ? colors.tip : colors.border }]}>★</Text>
                  ))}
                  <Text style={[styles.ratingNum, { color: colors.mutedForeground }]}>{service.rating.toFixed(1)}</Text>
                </View>
                <Text style={[styles.hiredCount, { color: colors.mutedForeground }]}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{service.hiredCount}</Text> hired
                </Text>
                {service.city && (
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{service.city}</Text>
                  </View>
                )}
              </View>

              <View style={[styles.trustMeter, { backgroundColor: colors.cardElevated }]}>
                <View style={[styles.trustFill, { width: `${service.trustScore}%`, backgroundColor: service.trustScore >= 70 ? colors.success : service.trustScore >= 40 ? colors.tip : "#EF4444" }]} />
              </View>
              <Text style={[styles.trustLabel, { color: colors.mutedForeground }]}>Trust Score: {service.trustScore}/100</Text>
            </View>

            {/* Proof of Intent */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Proof of Intent</Text>
              <View style={[styles.intentGrid]}>
                <View style={[styles.intentItem, { backgroundColor: service.trustScore >= 70 ? "#22C55E12" : colors.background, borderColor: service.trustScore >= 70 ? "#22C55E40" : colors.border, borderWidth: 1, borderRadius: 12, padding: 12, flex: 1 }]}>
                  <Feather name="shield" size={16} color={service.trustScore >= 70 ? "#22C55E" : colors.mutedForeground} />
                  <Text style={[styles.intentLabel, { color: service.trustScore >= 70 ? "#22C55E" : colors.mutedForeground }]}>Trust Verified</Text>
                  <Text style={[styles.intentValue, { color: colors.foreground }]}>{service.trustScore}/100</Text>
                </View>
                <View style={[styles.intentItem, { backgroundColor: service.hiredCount > 0 ? "#3B82F612" : colors.background, borderColor: service.hiredCount > 0 ? "#3B82F640" : colors.border, borderWidth: 1, borderRadius: 12, padding: 12, flex: 1 }]}>
                  <Feather name="briefcase" size={16} color={service.hiredCount > 0 ? "#3B82F6" : colors.mutedForeground} />
                  <Text style={[styles.intentLabel, { color: service.hiredCount > 0 ? "#3B82F6" : colors.mutedForeground }]}>Jobs Done</Text>
                  <Text style={[styles.intentValue, { color: colors.foreground }]}>{service.hiredCount}</Text>
                </View>
                <View style={[styles.intentItem, { backgroundColor: service.provider?.verified ? "#22C55E12" : colors.background, borderColor: service.provider?.verified ? "#22C55E40" : colors.border, borderWidth: 1, borderRadius: 12, padding: 12, flex: 1 }]}>
                  <Feather name="user-check" size={16} color={service.provider?.verified ? "#22C55E" : colors.mutedForeground} />
                  <Text style={[styles.intentLabel, { color: service.provider?.verified ? "#22C55E" : colors.mutedForeground }]}>ID Verified</Text>
                  <Text style={[styles.intentValue, { color: colors.foreground }]}>{service.provider?.verified ? "Yes" : "Pending"}</Text>
                </View>
              </View>
              {service.portfolioUrl && (
                <Pressable onPress={() => Linking.openURL(service.portfolioUrl!)} style={[styles.portfolioLink, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                  <Feather name="external-link" size={14} color={colors.primary} />
                  <Text style={[styles.portfolioText, { color: colors.primary }]}>View Portfolio Evidence</Text>
                </Pressable>
              )}
            </View>

            {/* Provider */}
            {service.provider && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About the Provider</Text>
                <Pressable onPress={() => router.push(`/profile/${service.provider!.id}`)} style={styles.providerRow}>
                  <Avatar avatarKey={service.provider.avatarKey} size={52} ring />
                  <View style={{ flex: 1 }}>
                    <View style={styles.provNameRow}>
                      <Text style={[styles.provName, { color: colors.foreground }]}>{service.provider.name}</Text>
                      {service.provider.verified && <Feather name="check-circle" size={14} color={colors.primary} />}
                    </View>
                    <Text style={[styles.provHandle, { color: colors.mutedForeground }]}>@{service.provider.handle}</Text>
                    {service.provider.title ? (
                      <Text style={[styles.provTitle, { color: colors.mutedForeground }]}>{service.provider.title} · {service.provider.company}</Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
                {service.provider.bio ? (
                  <Text style={[styles.provBio, { color: colors.foreground, borderTopColor: colors.border }]}>{service.provider.bio}</Text>
                ) : null}
                <View style={[styles.provStats, { borderTopColor: colors.border }]}>
                  <View style={styles.provStat}>
                    <Text style={[styles.provStatValue, { color: colors.foreground }]}>{service.provider.followersCount.toLocaleString()}</Text>
                    <Text style={[styles.provStatLabel, { color: colors.mutedForeground }]}>Followers</Text>
                  </View>
                  <View style={styles.provStat}>
                    <Text style={[styles.provStatValue, { color: colors.foreground }]}>{service.hiredCount}</Text>
                    <Text style={[styles.provStatLabel, { color: colors.mutedForeground }]}>Jobs Done</Text>
                  </View>
                  <View style={styles.provStat}>
                    <Text style={[styles.provStatValue, { color: colors.foreground }]}>{service.provider.city}</Text>
                    <Text style={[styles.provStatLabel, { color: colors.mutedForeground }]}>Location</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Portfolio */}
            {service.portfolioUrl && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Portfolio</Text>
                <Pressable onPress={() => Linking.openURL(service.portfolioUrl!)} style={[styles.portfolioLink, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                  <Feather name="external-link" size={14} color={colors.primary} />
                  <Text style={[styles.portfolioText, { color: colors.primary }]}>View Portfolio</Text>
                </Pressable>
              </View>
            )}

            {/* Related */}
            {service.related?.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={[styles.relatedTitle, { color: colors.foreground }]}>Similar Services</Text>
                {service.related.map((r) => (
                  <Pressable key={r.id} onPress={() => router.push(`/service/${r.id}`)} style={({ pressed }) => [styles.relatedCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
                    <Text style={[styles.relatedName, { color: colors.foreground }]}>{r.title}</Text>
                    <Text style={[styles.relatedMeta, { color: colors.mutedForeground }]}>{r.category} · {r.pricePi > 0 ? `${r.pricePi} π` : "Contact"}</Text>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Sticky 3-button action bar */}
          <View style={[styles.stickyBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
            <View>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Starting from</Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                {service.pricePi === 0 ? "Contact" : `${service.pricePi} π`}
              </Text>
            </View>
            <View style={styles.actionBtnGroup}>
              <Pressable onPress={() => setOfferOpen(true)} style={({ pressed }) => [styles.actionBtnSm, { backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                <Feather name="send" size={14} color={colors.primary} />
                <Text style={[styles.actionBtnSmText, { color: colors.primary }]}>Offer</Text>
              </Pressable>
              <Pressable onPress={() => setDonateOpen(true)} style={({ pressed }) => [styles.actionBtnSm, { backgroundColor: "#EF444415", borderWidth: 1, borderColor: "#EF444440", opacity: pressed ? 0.8 : 1 }]}>
                <Feather name="heart" size={14} color="#EF4444" />
                <Text style={[styles.actionBtnSmText, { color: "#EF4444" }]}>Donate</Text>
              </Pressable>
              <Pressable onPress={() => setEscrowOpen(true)} style={({ pressed }) => [styles.hireBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="lock" size={14} color="#fff" />
                <Text style={styles.hireBtnText}>{service.pricePi > 0 ? `Apply · π ${service.pricePi}` : "Apply"}</Text>
              </Pressable>
            </View>
          </View>

          <EscrowModal service={service} visible={escrowOpen} onClose={() => setEscrowOpen(false)} />
          <DonateModal service={service} visible={donateOpen} onClose={() => setDonateOpen(false)} />
          <SendOfferModal service={service} visible={offerOpen} onClose={() => setOfferOpen(false)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { padding: 20, borderBottomWidth: 1, gap: 10 },
  heroBadgeRow: { flexDirection: "row", gap: 8 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  trustedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  trustedText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 4 },
  heroDesc: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  star: { fontSize: 14 },
  ratingNum: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginLeft: 4 },
  hiredCount: { fontSize: 13, fontFamily: "Inter_500Medium" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  trustMeter: { height: 4, borderRadius: 2, overflow: "hidden" },
  trustFill: { height: "100%", borderRadius: 2 },
  trustLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  section: { margin: 16, borderRadius: 18, borderWidth: 1, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  provNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  provName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  provHandle: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  provTitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  provBio: { fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", paddingTop: 12, borderTopWidth: 1 },
  provStats: { flexDirection: "row", paddingTop: 12, borderTopWidth: 1 },
  provStat: { flex: 1, alignItems: "center" },
  provStatValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  provStatLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
  portfolioLink: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  portfolioText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  relatedSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  relatedTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  relatedCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  relatedName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  relatedMeta: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stickyBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  priceLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  priceValue: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  hireBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  hireBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  actionBtnGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtnSm: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  actionBtnSmText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  intentGrid: { flexDirection: "row", gap: 8 },
  intentItem: { alignItems: "center", gap: 4 },
  intentLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  intentValue: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
});

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, maxHeight: "90%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 0 },
  stageItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stageDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stageDotText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stageLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stageLine: { width: 28, height: 1.5, marginHorizontal: 4 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  serviceProv: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  termsBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  termsTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  termRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  termText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 4 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  amountRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  piSymbol: { fontSize: 22, fontFamily: "Inter_700Bold", marginRight: 6 },
  amountInput: { flex: 1, fontSize: 28, fontFamily: "Inter_700Bold", paddingVertical: 14 },
  scopeInput: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 80, fontSize: 14, fontFamily: "Inter_400Regular", textAlignVertical: "top" },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  confirmCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  confirmTitle: { fontSize: 15, fontFamily: "Inter_700Bold", padding: 14, borderBottomWidth: 1 },
  confirmRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  confirmLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  confirmValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1 },
  successWrap: { alignItems: "center", gap: 16, paddingVertical: 12 },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  successBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, width: "100%" },
  successNote: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
