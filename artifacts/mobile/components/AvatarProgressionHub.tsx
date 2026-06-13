import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useAvatarData, TIER_COLOR } from "@/lib/useAvatarData";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type Skin = {
  id: string;
  name: string;
  description: string;
  assetPath: string;
  tier: string;
  path: string;
  minLevel: number;
  unlockCondition: string;
  isPremium: boolean;
  sortOrder: number;
  unlocked: boolean;
};

const TIER_ORDER = ["legendary", "epic", "rare", "uncommon", "common"];
const TIER_LABEL: Record<string, string> = {
  legendary: "Legendary",
  epic: "Epic",
  rare: "Rare",
  uncommon: "Uncommon",
  common: "Common",
};

const QUESTS = [
  { icon: "sun", label: "Daily Check-in", xp: 25, description: "Log in every day to build your streak." },
  { icon: "zap", label: "Post a Project Capsule", xp: 30, description: "Share a weekly build update on any pitch." },
  { icon: "trending-up", label: "Launch a Pitch", xp: 100, description: "Publish your first project to the Hub." },
  { icon: "target", label: "Complete a Milestone", xp: 50, description: "Verify a funded milestone phase." },
  { icon: "lock", label: "Complete an Escrow", xp: 75, description: "Finish a smart escrow agreement." },
  { icon: "star", label: "3× Five-Star Review", xp: 60, description: "Earn three consecutive 5-star reviews." },
  { icon: "flame" as any, label: "30-Day Streak Bonus", xp: 200, description: "Maintain a 30-day consecutive check-in streak." },
  { icon: "users", label: "Back a Project", xp: 20, description: "Invest π in a peer's pitch." },
];

const PATH_COLOR: Record<string, string> = {
  builder: "#3B82F6",
  founder: "#F59E0B",
  investor: "#22C55E",
  none: "#6B7280",
};
const PATH_LABEL: Record<string, string> = {
  builder: "Builder",
  founder: "Founder",
  investor: "Investor",
  none: "No Path",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  avatarKey?: string | null;
};

export function AvatarProgressionHub({ visible, onClose, userId, avatarKey }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{ streak: number; xp: number; alreadyCheckedIn?: boolean } | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("all");

  const { data: avatarData, refetch: refetchAvatar } = useAvatarData(userId);

  const { data: skins } = useQuery<Skin[]>({
    queryKey: ["/api/avatar/skins"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/avatar/skins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && visible,
    staleTime: 60_000,
  });

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await fetch(`${API_BASE}/api/avatar/checkin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setCheckInResult(data);
      setCheckedIn(true);
      refetchAvatar();
      qc.invalidateQueries({ queryKey: [`/api/users/${userId}/avatar`] });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleEquipSkin = async (skinId: string) => {
    await fetch(`${API_BASE}/api/avatar/equip`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ skinId }),
    });
    refetchAvatar();
    qc.invalidateQueries({ queryKey: [`/api/users/${userId}/avatar`] });
  };

  if (!visible) return null;

  const level = avatarData?.level ?? 1;
  const xp = avatarData?.xp ?? 0;
  const nextLevelXp = avatarData?.nextLevelXp ?? 100;
  const xpToNext = avatarData?.xpToNextLevel ?? 100;
  const streak = avatarData?.dailyStreak ?? 0;
  const path = avatarData?.path ?? "none";
  const decayActive = avatarData?.decayActive ?? false;
  const activeSkinTier = avatarData?.activeSkin?.tier ?? "common";
  const activeSkinName = avatarData?.activeSkin?.name ?? "Default";
  const xpPct = nextLevelXp > 0 ? Math.min(100, Math.round(((nextLevelXp - xpToNext) / nextLevelXp) * 100)) : 100;

  const filteredSkins = (skins ?? []).filter(
    (s) => tierFilter === "all" || s.tier === tierFilter
  );
  const groupedSkins: Record<string, Skin[]> = {};
  if (tierFilter === "all") {
    for (const t of TIER_ORDER) {
      const ts = (skins ?? []).filter((s) => s.tier === t);
      if (ts.length > 0) groupedSkins[t] = ts;
    }
  } else {
    groupedSkins[tierFilter] = filteredSkins;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10} style={[s.closeBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
            <Feather name="x" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>Avatar & Progression</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>Level up by building in public</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        >
          {/* Avatar Preview Card */}
          <View style={[s.avatarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.avatarRow}>
              <View style={{ alignItems: "center" }}>
                <Avatar
                  avatarKey={avatarKey}
                  size={100}
                  ring
                  level={level}
                  skinTier={activeSkinTier}
                />
                {decayActive && (
                  <View style={[s.decayBadge, { backgroundColor: "#EF444418", borderColor: "#EF4444" }]}>
                    <Text style={{ fontSize: 10, color: "#EF4444", fontFamily: "Inter_600SemiBold" }}>⚠ Decay Active</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 18 }}>
                <View style={s.chipRow}>
                  <View style={[s.chip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "50" }]}>
                    <Text style={[s.chipText, { color: colors.primary }]}>Lv {level}</Text>
                  </View>
                  <View style={[s.chip, { backgroundColor: (PATH_COLOR[path] ?? "#6B7280") + "18", borderColor: (PATH_COLOR[path] ?? "#6B7280") + "50" }]}>
                    <Text style={[s.chipText, { color: PATH_COLOR[path] ?? "#6B7280" }]}>{PATH_LABEL[path] ?? "No Path"}</Text>
                  </View>
                </View>
                <Text style={[s.skinName, { color: colors.foreground }]}>{activeSkinName}</Text>
                <View style={[s.tierBadge, { backgroundColor: (TIER_COLOR[activeSkinTier] ?? "#94A3B8") + "20", borderColor: (TIER_COLOR[activeSkinTier] ?? "#94A3B8") + "60" }]}>
                  <Text style={[s.tierText, { color: TIER_COLOR[activeSkinTier] ?? "#94A3B8" }]}>
                    {(activeSkinTier ?? "common").charAt(0).toUpperCase() + (activeSkinTier ?? "common").slice(1)} Skin
                  </Text>
                </View>
                {streak > 0 && (
                  <View style={[s.streakRow]}>
                    <Text style={{ fontSize: 14 }}>🔥</Text>
                    <Text style={[s.streakCount, { color: "#F59E0B" }]}>{streak}-day streak</Text>
                  </View>
                )}
              </View>
            </View>

            {/* XP Progress Bar */}
            <View style={[s.xpSection, { borderTopColor: colors.border }]}>
              <View style={s.xpLabelRow}>
                <Text style={[s.xpLabel, { color: colors.mutedForeground }]}>XP Progress</Text>
                <Text style={[s.xpValue, { color: colors.foreground }]}>
                  {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
                </Text>
              </View>
              <View style={[s.xpTrack, { backgroundColor: colors.border }]}>
                <View style={[s.xpFill, { width: `${xpPct}%` as any, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[s.xpSub, { color: colors.mutedForeground }]}>
                {xpToNext > 0 ? `${xpToNext} XP to Level ${level + 1}` : "Max level reached!"}
              </Text>
            </View>
          </View>

          {/* Daily Check-in */}
          {!checkInResult ? (
            <Pressable
              onPress={handleCheckIn}
              disabled={checkingIn || checkedIn}
              style={({ pressed }) => [
                s.checkInBtn,
                { backgroundColor: checkedIn ? colors.cardElevated : colors.primary, opacity: pressed ? 0.85 : 1, borderColor: checkedIn ? colors.border : colors.primary },
              ]}
            >
              {checkingIn ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>☀️</Text>
                  <Text style={[s.checkInText, { color: checkedIn ? colors.mutedForeground : "#fff" }]}>
                    {checkedIn ? "Already Checked In Today" : "Daily Check-in  +25 XP"}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={[s.checkInResult, { backgroundColor: checkInResult.alreadyCheckedIn ? colors.cardElevated : "#22C55E18", borderColor: checkInResult.alreadyCheckedIn ? colors.border : "#22C55E" }]}>
              <Text style={{ fontSize: 20 }}>{checkInResult.alreadyCheckedIn ? "✅" : "🎉"}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.checkInResultTitle, { color: checkInResult.alreadyCheckedIn ? colors.mutedForeground : "#22C55E" }]}>
                  {checkInResult.alreadyCheckedIn ? "Already checked in today!" : `+25 XP Awarded!`}
                </Text>
                {!checkInResult.alreadyCheckedIn && (
                  <Text style={[s.checkInResultSub, { color: colors.mutedForeground }]}>
                    Streak: {checkInResult.streak} days 🔥
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Skins Gallery */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Skins Gallery</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{(skins ?? []).filter((s) => s.unlocked).length} unlocked</Text>
          </View>

          {/* Tier filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingRight: 16 }}>
              {["all", ...TIER_ORDER].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTierFilter(t)}
                  style={[
                    s.tierPill,
                    {
                      backgroundColor: tierFilter === t ? (t === "all" ? colors.primary : (TIER_COLOR[t] ?? colors.primary)) + "20" : colors.card,
                      borderColor: tierFilter === t ? (t === "all" ? colors.primary : (TIER_COLOR[t] ?? colors.primary)) : colors.border,
                    },
                  ]}
                >
                  <Text style={[s.tierPillText, { color: tierFilter === t ? (t === "all" ? colors.primary : (TIER_COLOR[t] ?? colors.primary)) : colors.mutedForeground }]}>
                    {t === "all" ? "All" : TIER_LABEL[t] ?? t}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {Object.entries(groupedSkins).map(([tier, tierSkins]) => (
            <View key={tier} style={{ marginBottom: 16 }}>
              <View style={s.tierGroupHeader}>
                <View style={[s.tierDot, { backgroundColor: TIER_COLOR[tier] ?? "#94A3B8" }]} />
                <Text style={[s.tierGroupLabel, { color: TIER_COLOR[tier] ?? "#94A3B8" }]}>
                  {TIER_LABEL[tier] ?? tier}
                </Text>
              </View>
              <View style={s.skinGrid}>
                {tierSkins.map((skin) => {
                  const isEquipped = avatarData?.activeSkin?.name === skin.name;
                  const tierColor = TIER_COLOR[skin.tier] ?? "#94A3B8";
                  return (
                    <Pressable
                      key={skin.id}
                      onPress={() => skin.unlocked && !isEquipped && handleEquipSkin(skin.id)}
                      style={({ pressed }) => [
                        s.skinCard,
                        {
                          backgroundColor: isEquipped ? colors.primary + "12" : colors.card,
                          borderColor: isEquipped ? colors.primary : skin.unlocked ? tierColor + "60" : colors.border,
                          opacity: pressed && skin.unlocked ? 0.85 : 1,
                        },
                      ]}
                    >
                      {/* Skin color swatch */}
                      <View style={[s.skinSwatch, { backgroundColor: tierColor + "30", borderColor: tierColor + "60" }]}>
                        {skin.unlocked ? (
                          <Text style={{ fontSize: 20 }}>
                            {skin.tier === "legendary" ? "🌟" : skin.tier === "epic" ? "💎" : skin.tier === "rare" ? "✨" : skin.tier === "uncommon" ? "🔮" : "🎭"}
                          </Text>
                        ) : (
                          <Feather name="lock" size={18} color={colors.mutedForeground} />
                        )}
                      </View>
                      <Text style={[s.skinCardName, { color: skin.unlocked ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                        {skin.name}
                      </Text>
                      {isEquipped && (
                        <View style={[s.equippedChip, { backgroundColor: colors.primary }]}>
                          <Text style={s.equippedText}>Equipped</Text>
                        </View>
                      )}
                      {!skin.unlocked && (
                        <Text style={[s.skinUnlockCond, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {skin.unlockCondition || `Lv ${skin.minLevel}+`}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {(!skins || skins.length === 0) && (
            <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="layers" size={24} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Loading skins…</Text>
            </View>
          )}

          {/* Evolution Quests */}
          <Text style={[s.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Evolution Quests</Text>
          <Text style={[s.sectionSub, { color: colors.mutedForeground, marginBottom: 12 }]}>Complete actions to earn XP and unlock skins</Text>

          <View style={[s.questCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {QUESTS.map((q, i) => (
              <View
                key={q.label}
                style={[
                  s.questRow,
                  { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
                ]}
              >
                <View style={[s.questIconWrap, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name={q.icon as any} size={15} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.questLabel, { color: colors.foreground }]}>{q.label}</Text>
                  <Text style={[s.questDesc, { color: colors.mutedForeground }]}>{q.description}</Text>
                </View>
                <View style={[s.xpChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
                  <Text style={[s.xpChipText, { color: colors.primary }]}>+{q.xp} XP</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  avatarCard: { borderRadius: 20, borderWidth: 1, padding: 18, marginBottom: 12 },
  avatarRow: { flexDirection: "row", alignItems: "flex-start" },
  decayBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  skinName: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  tierBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, marginBottom: 8 },
  tierText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  streakCount: { fontSize: 13, fontFamily: "Inter_700Bold" },

  xpSection: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  xpLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  xpLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  xpValue: { fontSize: 12, fontFamily: "Inter_700Bold" },
  xpTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  xpFill: { height: "100%", borderRadius: 4 },
  xpSub: { fontSize: 11, fontFamily: "Inter_500Medium" },

  checkInBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  checkInText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  checkInResult: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  checkInResultTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  checkInResultSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, fontFamily: "Inter_500Medium" },

  tierPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  tierPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  tierGroupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierGroupLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },

  skinGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skinCard: { width: "47%", borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 6 },
  skinSwatch: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  skinCardName: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  equippedChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  equippedText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },
  skinUnlockCond: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },

  emptyBox: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 8, marginBottom: 16 },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  questCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  questRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  questIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  questLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  questDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  xpChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  xpChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
