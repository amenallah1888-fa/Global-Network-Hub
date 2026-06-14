import { Feather } from "@expo/vector-icons";
import { useListPitches } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { Header } from "@/components/Header";
import {
  EMPTY_FILTERS,
  HubFiltersSheet,
  activeFilterCount,
  fundingBandMatches,
  type HubFilters,
} from "@/components/HubFiltersSheet";
import { PitchCard } from "@/components/PitchCard";
import { PitchComposerSheet } from "@/components/PitchComposerSheet";
import { SegmentControl } from "@/components/SegmentControl";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type ServiceComposerProps = {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

function ServiceComposerSheet({ visible, onClose, onSubmitted }: ServiceComposerProps) {
  const colors = useColors();
  const { token } = useAuth();
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcCategory, setSvcCategory] = useState("Development");
  const [svcPrice, setSvcPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setSvcTitle(""); setSvcDesc(""); setSvcCategory("Development"); setSvcPrice(""); setError(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!svcTitle.trim()) { setError("Service title is required."); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/services`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: svcTitle.trim(),
          description: svcDesc.trim(),
          category: svcCategory,
          pricePi: parseFloat(svcPrice) || 0,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Could not list service.");
        return;
      }
      reset(); onSubmitted();
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={scs.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={[scs.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={scs.handle} />
          <View style={[scs.header, { borderBottomColor: colors.border }]}>
            <View style={[scs.iconWrap, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="grid" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[scs.title, { color: colors.foreground }]}>Offer a Service</Text>
              <Text style={[scs.sub, { color: colors.mutedForeground }]}>List your skill in the π marketplace</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {[
              { label: "Service Title *", value: svcTitle, set: setSvcTitle, placeholder: "e.g. Smart Contract Audit" },
              { label: "Price (π)", value: svcPrice, set: setSvcPrice, placeholder: "0 = Contact for price", keyboard: "numeric" },
            ].map(({ label, value, set, placeholder, keyboard }: any) => (
              <View key={label} style={scs.fieldWrap}>
                <Text style={[scs.label, { color: colors.mutedForeground }]}>{label}</Text>
                <TextInput
                  value={value} onChangeText={set} placeholder={placeholder}
                  keyboardType={keyboard ?? "default"}
                  placeholderTextColor={colors.mutedForeground}
                  style={[scs.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>
            ))}
            <View style={scs.fieldWrap}>
              <Text style={[scs.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                value={svcDesc} onChangeText={setSvcDesc} placeholder="What exactly do you offer?" multiline
                placeholderTextColor={colors.mutedForeground}
                style={[scs.textarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            </View>
            <View style={scs.fieldWrap}>
              <Text style={[scs.label, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {SERVICE_CATEGORIES.filter(c => c !== "All").map((c) => (
                  <Pressable key={c} onPress={() => setSvcCategory(c)} style={[scs.chip, { backgroundColor: svcCategory === c ? colors.primary : colors.cardElevated, borderColor: svcCategory === c ? colors.primary : colors.border }]}>
                    <Text style={{ color: svcCategory === c ? "#fff" : colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {error ? (
              <View style={[scs.error, { backgroundColor: "#EF444415", borderColor: "#EF4444" }]}>
                <Feather name="alert-circle" size={12} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>{error}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleSubmit} disabled={submitting}
              style={({ pressed }) => [scs.btn, { backgroundColor: colors.primary, opacity: pressed || submitting ? 0.8 : 1 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={scs.btnText}>List My Service</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const scs = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, maxHeight: "90%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 70, textAlignVertical: "top" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const STAGES = ["All", "Pre-seed", "Seed", "Series A", "Series B"];
const SERVICE_CATEGORIES = ["All", "Development", "Design", "Marketing", "Logistics", "Legal", "Copywriting", "Finance"];

type HubTab = "pitches" | "services" | "apps";

type ServiceApp = {
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
  provider: { id: string; name: string; handle: string; avatarKey: string | null; verified: boolean; city: string } | null;
};

type DApp = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl?: string;
  platform: string;
  verifiedLink: string;
  securityScore: number;
  category: string;
  submissionStatus: string;
};

const CAT_COLORS: Record<string, string> = {
  Development: "#6366F1", Design: "#EC4899", Marketing: "#F59E0B",
  Logistics: "#10B981", Legal: "#8B5CF6", Copywriting: "#0EA5E9", Finance: "#14B8A6",
};

const DAPP_CATEGORIES = ["DeFi", "NFT", "Gaming", "Social", "Commerce", "Utility", "Other"];

function DAppSubmitSheet({ visible, onClose, onSubmitted }: { visible: boolean; onClose: () => void; onSubmitted: () => void }) {
  const colors = useColors();
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [verifiedLink, setVerifiedLink] = useState("");
  const [category, setCategory] = useState("Utility");
  const [platform, setPlatform] = useState("Web");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setName(""); setTagline(""); setDescription(""); setVerifiedLink(""); setCategory("Utility"); setPlatform("Web"); setError(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("App name is required."); return; }
    if (!verifiedLink.trim()) { setError("Verified app link is required."); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pitches`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name.trim(),
          summary: tagline.trim() || description.trim(),
          description: description.trim(),
          entityType: "app",
          platform,
          category,
          verifiedLink: verifiedLink.trim(),
          trustScore: 0,
          stage: "App",
          industry: category,
          raising: 0,
          city: "",
        }),
      });
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Submission failed."); return; }
      reset(); onSubmitted();
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={daSt.backdrop}>
        <Pressable style={daSt.overlayHit} onPress={handleClose} />
        <View style={[daSt.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={daSt.handle} />
          <View style={[daSt.header, { borderBottomColor: colors.border }]}>
            <View style={[daSt.iconWrap, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="upload" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[daSt.title, { color: colors.foreground }]}>Submit a DApp</Text>
              <Text style={[daSt.sub, { color: colors.mutedForeground }]}>Pi ecosystem app · reviewed before listing</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {[
              { label: "App Name *", value: name, set: setName, placeholder: "My Pi App" },
              { label: "Tagline", value: tagline, set: setTagline, placeholder: "One-line description" },
              { label: "Verified Link *", value: verifiedLink, set: setVerifiedLink, placeholder: "https://minepi.com/app/..." },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label} style={daSt.fieldWrap}>
                <Text style={[daSt.label, { color: colors.mutedForeground }]}>{label}</Text>
                <TextInput
                  value={value} onChangeText={set} placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  style={[daSt.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>
            ))}
            <View style={daSt.fieldWrap}>
              <Text style={[daSt.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                value={description} onChangeText={setDescription} placeholder="What does your app do?" multiline
                placeholderTextColor={colors.mutedForeground}
                style={[daSt.textarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            </View>
            <View style={daSt.fieldWrap}>
              <Text style={[daSt.label, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {DAPP_CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCategory(c)} style={[daSt.chip, { backgroundColor: category === c ? colors.primary : colors.cardElevated, borderColor: category === c ? colors.primary : colors.border }]}>
                    <Text style={{ color: category === c ? "#fff" : colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {error ? (
              <View style={[daSt.error, { backgroundColor: "#EF444415", borderColor: "#EF4444" }]}>
                <Feather name="alert-circle" size={12} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>{error}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleSubmit} disabled={submitting}
              style={({ pressed }) => [daSt.btn, { backgroundColor: colors.primary, opacity: pressed || submitting ? 0.8 : 1 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={daSt.btnText}>Submit for Review</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const daSt = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  overlayHit: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, maxHeight: "90%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 70, textAlignVertical: "top" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

function ServiceCard({ service }: { service: ServiceApp }) {
  const colors = useColors();
  const stars = Math.round(service.rating);
  const catColor = CAT_COLORS[service.category] ?? colors.primary;

  return (
    <Pressable
      onPress={() => router.push(`/service/${service.id}`)}
      style={({ pressed }) => [sc.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={sc.header}>
        <View style={[sc.catBadge, { backgroundColor: catColor + "18", borderColor: catColor + "40" }]}>
          <Text style={[sc.catText, { color: catColor }]}>{service.category}</Text>
        </View>
        {service.trustScore >= 70 && (
          <View style={[sc.trustedBadge, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
            <Feather name="shield" size={10} color={colors.success} />
            <Text style={[sc.trustedText, { color: colors.success }]}>Trusted</Text>
          </View>
        )}
      </View>

      <Text style={[sc.title, { color: colors.foreground }]}>{service.title}</Text>
      <Text style={[sc.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{service.description}</Text>

      <View style={sc.providerRow}>
        <Avatar avatarKey={service.provider?.avatarKey ?? null} size={28} />
        <View style={{ flex: 1 }}>
          <Text style={[sc.providerName, { color: colors.foreground }]}>{service.provider?.name ?? "Provider"}</Text>
          <Text style={[sc.providerCity, { color: colors.mutedForeground }]}>{service.city ?? service.provider?.city ?? "Global"}</Text>
        </View>
        <View style={sc.ratingRow}>
          {"★★★★★".split("").map((_, i) => (
            <Text key={i} style={[sc.star, { color: i < stars ? colors.tip : colors.border }]}>★</Text>
          ))}
        </View>
      </View>

      <View style={[sc.footer, { borderTopColor: colors.border }]}>
        <View style={[sc.priceTag, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[sc.priceText, { color: colors.primary }]}>
            {service.pricePi === 0 ? "Contact for price" : `From ${service.pricePi} π`}
          </Text>
        </View>
        <Text style={[sc.hired, { color: colors.mutedForeground }]}>{service.hiredCount} hired</Text>
      </View>
    </Pressable>
  );
}

const sc = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  trustedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  trustedText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  providerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  providerCity: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  ratingRow: { flexDirection: "row" },
  star: { fontSize: 13 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1 },
  priceTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  priceText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hired: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

const PLATFORM_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Mobile: "smartphone", PC: "monitor", Both: "layers",
};

const SECURITY_COLORS = (score: number) =>
  score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";

function DAppCard({ app }: { app: DApp }) {
  const colors = useColors();
  const secColor = SECURITY_COLORS(app.securityScore);
  const platformIcon = PLATFORM_ICONS[app.platform] ?? "grid";

  const handleLaunch = () => {
    if (app.verifiedLink.startsWith("pinetwork://")) {
      Linking.openURL(app.verifiedLink).catch(() => {});
    } else {
      Linking.openURL(app.verifiedLink).catch(() => {});
    }
  };

  return (
    <View style={[da.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={da.top}>
        <View style={[da.logo, { backgroundColor: colors.primary + "15" }]}>
          <Feather name="zap" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={da.nameRow}>
            <Text style={[da.name, { color: colors.foreground }]}>{app.name}</Text>
            <View style={[da.secBadge, { backgroundColor: secColor + "18", borderColor: secColor + "40" }]}>
              <Feather name="shield" size={9} color={secColor} />
              <Text style={[da.secText, { color: secColor }]}>{app.securityScore}</Text>
            </View>
          </View>
          <Text style={[da.tagline, { color: colors.mutedForeground }]} numberOfLines={1}>{app.tagline}</Text>
          <View style={da.tagRow}>
            <View style={[da.platformTag, { backgroundColor: colors.cardElevated }]}>
              <Feather name={platformIcon} size={10} color={colors.mutedForeground} />
              <Text style={[da.platformText, { color: colors.mutedForeground }]}>{app.platform}</Text>
            </View>
            <View style={[da.platformTag, { backgroundColor: colors.cardElevated }]}>
              <Text style={[da.platformText, { color: colors.mutedForeground }]}>{app.category}</Text>
            </View>
          </View>
        </View>
      </View>

      {app.description ? (
        <Text style={[da.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{app.description}</Text>
      ) : null}

      <View style={[da.footer, { borderTopColor: colors.border }]}>
        <View style={da.verifiedRow}>
          <Feather name="check-circle" size={12} color={colors.success} />
          <Text style={[da.verifiedText, { color: colors.success }]}>Verified Pi App</Text>
        </View>
        <Pressable onPress={handleLaunch} style={({ pressed }) => [da.launchBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
          <Feather name="external-link" size={13} color="#fff" />
          <Text style={da.launchText}>Launch App</Text>
        </Pressable>
      </View>
    </View>
  );
}

const da = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 12, gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  logo: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  name: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  secBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  secText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  tagRow: { flexDirection: "row", gap: 6 },
  platformTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  platformText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1 },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  verifiedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  launchBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  launchText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
});

export default function PitchesScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const [hubTab, setHubTab] = useState<HubTab>("pitches");
  const [stage, setStage] = useState("All");
  const [serviceCategory, setServiceCategory] = useState("All");
  const [composerOpen, setComposerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<HubFilters>(EMPTY_FILTERS);
  const [dappSubmitOpen, setDappSubmitOpen] = useState(false);
  const [serviceComposerOpen, setServiceComposerOpen] = useState(false);

  const { data: meData } = useQuery<any>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("auth");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const isKycVerified = meData?.kycStatus === "verified";

  const requireKyc = (action: () => void) => {
    if (!isKycVerified) {
      Alert.alert(
        "KYC Verification Required",
        "You need to complete KYC verification to publish on the Hub. Go to Profile → Settings → Account to start verification.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    action();
  };

  const { data: pitches, isLoading: pitchesLoading } = useListPitches();
  const { data: services, isLoading: servicesLoading, refetch: servicesRefetch } = useQuery<ServiceApp[]>({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/services`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!token,
  });
  const { data: apps, isLoading: appsLoading, refetch: appsRefetch } = useQuery<DApp[]>({
    queryKey: ["/api/apps"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/apps`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const list = pitches ?? [];
  const serviceList = services ?? [];
  const appList = apps ?? [];

  const visiblePitches = useMemo(() => {
    return list.filter((p) => {
      if ((p as any).entityType === "service_app") return false;
      if (stage !== "All" && p.stage !== stage) return false;
      if (filters.industries.length > 0 && !filters.industries.includes(p.industry)) return false;
      if (filters.cities.length > 0 && !filters.cities.includes(p.city)) return false;
      if (!fundingBandMatches(p.raising, filters.funding)) return false;
      return true;
    });
  }, [list, stage, filters]);

  const visibleServices = useMemo(() => {
    if (serviceCategory === "All") return serviceList;
    return serviceList.filter((s) => s.category === serviceCategory);
  }, [serviceList, serviceCategory]);

  const totalRaising = visiblePitches.reduce((s, p) => s + (p.raising - p.raised), 0);
  const filterCount = activeFilterCount(filters);

  const HUB_TABS: { key: HubTab; label: string; icon: keyof typeof Feather.glyphMap; count?: number }[] = [
    { key: "pitches", label: "Pitches", icon: "zap", count: visiblePitches.length },
    { key: "services", label: "Services", icon: "grid", count: serviceList.length },
    { key: "apps", label: "Apps", icon: "cpu", count: appList.length },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Investment Hub"
        subtitle="Curated deal flow & Pi ecosystem"
        rightIcon="filter"
        onRightPress={() => setFiltersOpen(true)}
      />

      {/* Main tab switcher */}
      <View style={[styles.mainTabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {HUB_TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setHubTab(t.key)} style={[styles.mainTab, { borderBottomColor: hubTab === t.key ? colors.primary : "transparent" }]}>
            <Feather name={t.icon} size={14} color={hubTab === t.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.mainTabText, { color: hubTab === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
            {t.count !== undefined && t.count > 0 && (
              <View style={[styles.tabCount, { backgroundColor: hubTab === t.key ? colors.primary + "20" : colors.cardElevated }]}>
                <Text style={[styles.tabCountText, { color: hubTab === t.key ? colors.primary : colors.mutedForeground }]}>{t.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* PITCHES TAB */}
      {hubTab === "pitches" && (
        <FlatList
          data={visiblePitches}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PitchCard pitch={item} />}
          ListHeaderComponent={
            <View>
              <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>OPEN ALLOCATION</Text>
                  <Text style={[styles.heroValue, { color: colors.foreground }]}>{(totalRaising / 1_000_000).toFixed(1)}M π</Text>
                  <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>across {visiblePitches.length} live {visiblePitches.length === 1 ? "round" : "rounds"}</Text>
                </View>
                <Pressable onPress={() => setComposerOpen(true)} style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.heroBtnText, { color: colors.primaryForeground }]}>Pitch</Text>
                </Pressable>
              </View>

              <View style={{ paddingVertical: 12 }}>
                <SegmentControl options={STAGES} value={stage} onChange={setStage} scrollable />
              </View>

              {filterCount > 0 && (
                <View style={styles.activeFilterRow}>
                  <Pressable onPress={() => setFiltersOpen(true)} style={[styles.activeFilterChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
                    <Feather name="sliders" size={12} color={colors.primary} />
                    <Text style={[styles.activeFilterText, { color: colors.primary }]}>{filterCount} filter{filterCount === 1 ? "" : "s"} active</Text>
                  </Pressable>
                  <Pressable onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={6}>
                    <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            pitchesLoading ? (
              <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={styles.empty}>
                <Feather name="briefcase" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {filterCount > 0 || stage !== "All" ? "No rounds match your filters" : "No live rounds yet"}
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {filterCount > 0 || stage !== "All" ? "Try clearing a filter or widening the stage." : "Be the first to publish a pitch to the Hub."}
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* SERVICES TAB */}
      {hubTab === "services" && (
        <FlatList
          data={visibleServices}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <ServiceCard service={item} />}
          ListHeaderComponent={
            <View>
              <View style={[styles.servicesHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>SERVICE MARKETPLACE</Text>
                  <Text style={[styles.heroValue, { color: colors.foreground }]}>{serviceList.length}</Text>
                  <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>providers accepting Pi</Text>
                </View>
                <Pressable onPress={() => setServiceComposerOpen(true)} style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={[styles.heroBtnText, { color: "#fff" }]}>Offer</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                {SERVICE_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setServiceCategory(cat)}
                    style={({ pressed }) => [styles.catChip, {
                      backgroundColor: serviceCategory === cat ? colors.primary : colors.card,
                      borderColor: serviceCategory === cat ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={[styles.catChipText, { color: serviceCategory === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            servicesLoading ? (
              <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={styles.empty}>
                <Feather name="grid" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No services yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Be the first to list a service and get hired in Pi.</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* APPS TAB */}
      {hubTab === "apps" && (
        <FlatList
          data={appList}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <DAppCard app={item} />}
          ListHeaderComponent={
            <View>
              <View style={[styles.appsHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.appsHeroLeft, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name="cpu" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.appsHeroTitle, { color: colors.foreground }]}>Pi Ecosystem Apps</Text>
                  <Text style={[styles.appsHeroSub, { color: colors.mutedForeground }]}>{appList.length} verified DApps on Pi Network</Text>
                </View>
                <Pressable onPress={() => setDappSubmitOpen(true)} style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Feather name="upload" size={13} color="#fff" />
                  <Text style={[styles.heroBtnText, { color: "#fff", fontSize: 12 }]}>Submit App</Text>
                </Pressable>
              </View>
              <View style={[styles.securityNote, { backgroundColor: colors.success + "10", borderColor: colors.success + "30" }]}>
                <Feather name="shield" size={13} color={colors.success} />
                <Text style={[styles.securityNoteText, { color: colors.success }]}>
                  All apps verified against official Pi Network domain whitelist. No malicious redirects.
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            appsLoading ? (
              <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={styles.empty}>
                <Feather name="cpu" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No approved apps yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Pi ecosystem DApps are reviewed before listing. Check back soon.
                </Text>
                <Pressable
                  onPress={() => setDappSubmitOpen(true)}
                  style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 8 }]}
                >
                  <Feather name="upload" size={14} color="#fff" />
                  <Text style={[styles.heroBtnText, { color: "#fff" }]}>Submit Your App</Text>
                </Pressable>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PitchComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} />
      <HubFiltersSheet visible={filtersOpen} initial={filters} onApply={setFilters} onClose={() => setFiltersOpen(false)} />
      <DAppSubmitSheet visible={dappSubmitOpen} onClose={() => setDappSubmitOpen(false)} onSubmitted={() => { setDappSubmitOpen(false); appsRefetch(); }} />
      <ServiceComposerSheet visible={serviceComposerOpen} onClose={() => setServiceComposerOpen(false)} onSubmitted={() => { setServiceComposerOpen(false); servicesRefetch(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mainTabRow: { flexDirection: "row", borderBottomWidth: 1 },
  mainTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, borderBottomWidth: 2 },
  mainTabText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  tabCountText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  hero: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  servicesHero: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  appsHero: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  appsHeroLeft: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appsHeroTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  appsHeroSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3 },
  securityNote: { marginHorizontal: 16, marginTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  securityNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  heroLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.4 },
  heroValue: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -1, marginTop: 6 },
  heroSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  heroBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  marketplaceBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  marketplaceBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  catChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activeFilterRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeFilterChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  activeFilterText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  clearText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
