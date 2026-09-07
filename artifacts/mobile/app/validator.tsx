import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useAvatarData } from "@/lib/useAvatarData";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
const BLOCKS = ["identity", "reality", "roadmap", "portfolio"] as const;

type ValidatorPitch = {
  id: string;
  title: string;
  description?: string | null;
  founder?: { name: string; handle: string } | null;
  trustScore?: number;
  validatorApprovals?: Record<string, string>;
};

export default function ValidatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const avatar = useAvatarData(user?.id);
  const [pitch, setPitch] = useState<ValidatorPitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const eligible = Boolean(user?.verified)
    && user?.kycStatus === "verified"
    && (user?.reputationScore ?? 0) >= 85
    && (avatar.data?.level ?? 0) >= 5;

  const loadPitch = useCallback(async () => {
    if (!token || !eligible) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/validator/random-pitch`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not load a project for review");
      setPitch(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load a project for review");
    } finally {
      setLoading(false);
    }
  }, [eligible, token]);

  useEffect(() => {
    void loadPitch();
  }, [loadPitch]);

  const validateBlock = async (block: string, action: "approve" | "reject") => {
    if (!pitch || !token) return;
    setWorking(`${block}-${action}`);
    try {
      const response = await fetch(`${API_BASE}/api/pitches/${pitch.id}/validate-block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ block, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Validation failed");
      setPitch(payload.pitch ?? { ...pitch, validatorApprovals: payload.validatorApprovals, trustScore: payload.trustScore });
      if (payload.migrated) Alert.alert("Project verified", "All four validation blocks are approved and this project is now live.");
    } catch (cause) {
      Alert.alert("Validation failed", cause instanceof Error ? cause.message : "Could not record this review");
    } finally {
      setWorking(null);
    }
  };

  if (!eligible) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 26 }]}>
        <Feather name="lock" size={34} color={colors.warning} />
        <Text style={[styles.title, { color: colors.foreground }]}>Validator Portal locked</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Access requires a verified account, completed KYC, Level 5, and at least 85 reputation.
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold" }}>Return to workspace</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Validator Portal</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Review project trust blocks</Text>
        </View>
        <Pressable onPress={() => void loadPitch()} hitSlop={10}>
          <Feather name="refresh-cw" size={18} color={colors.foreground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
        <View style={[styles.statusCard, { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}35` }]}>
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>Eligible validator · Level {avatar.data?.level ?? 0} · {user?.reputationScore ?? 0} reputation</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : error ? (
          <EmptyState colors={colors} text={error} />
        ) : !pitch ? (
          <EmptyState colors={colors} text="No projects are waiting for validation right now." />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>PROJECT FOR REVIEW</Text>
              <Text style={[styles.projectTitle, { color: colors.foreground }]}>{pitch.title}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {pitch.founder ? `${pitch.founder.name} · @${pitch.founder.handle}` : "Founder details unavailable"} · Trust {pitch.trustScore ?? 0}/100
              </Text>
              {!!pitch.description && <Text style={[styles.description, { color: colors.foreground }]}>{pitch.description}</Text>}
              <Pressable onPress={() => router.push(`/pitch/${pitch.id}`)} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                <Feather name="external-link" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>Open full project</Text>
              </Pressable>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trust verification blocks</Text>
            {BLOCKS.map((block) => {
              const current = pitch.validatorApprovals?.[block];
              return (
                <View key={block} style={[styles.block, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.blockTitle, { color: colors.foreground }]}>{block[0].toUpperCase() + block.slice(1)}</Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>{current ? `Recorded: ${current}` : "Not reviewed yet"} · 25 points</Text>
                  </View>
                  <Pressable disabled={!!working} onPress={() => void validateBlock(block, "reject")} style={[styles.voteButton, { borderColor: colors.destructive }]}>
                    <Feather name="x" size={15} color={colors.destructive} />
                  </Pressable>
                  <Pressable disabled={!!working} onPress={() => void validateBlock(block, "approve")} style={[styles.voteButton, { backgroundColor: colors.success, borderColor: colors.success }]}>
                    {working === `${block}-approve` ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={15} color="#fff" />}
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({ colors, text }: { colors: ReturnType<typeof useColors>; text: string }) {
  return <View style={styles.empty}><Feather name="inbox" size={28} color={colors.mutedForeground} /><Text style={[styles.body, { color: colors.mutedForeground }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  content: { padding: 18, gap: 14 },
  title: { fontSize: 21, fontFamily: "Inter_700Bold", textAlign: "center" },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, textAlign: "center", maxWidth: 360 },
  primaryButton: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, marginTop: 8 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 9, padding: 13, borderRadius: 12, borderWidth: 1 },
  statusText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  projectTitle: { fontSize: 23, fontFamily: "Inter_700Bold", marginTop: 8 },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5 },
  description: { fontSize: 13, lineHeight: 20, marginTop: 14, fontFamily: "Inter_400Regular" },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 11, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 6 },
  block: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, padding: 13 },
  blockTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  voteButton: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 70 },
});