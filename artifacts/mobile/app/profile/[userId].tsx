import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Circle, Pitch, Post, User } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type PublicProfile = User & {
  pitches: (Pitch & { requirements?: { type: string; description: string }[] })[];
  circles: Circle[];
};

function formatPi(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M π`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K π`;
  return `${n} π`;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type Tab = "posts" | "pitches" | "circles";

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("posts");

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: [`/api/users/${userId}`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!userId && !!token,
    staleTime: 15_000,
  });

  const { data: userPosts } = useQuery<Post[]>({
    queryKey: [`/api/posts/user/${userId}`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const all: Post[] = await res.json();
      return all.filter((p) => p.authorId === userId);
    },
    enabled: !!userId && !!token,
    staleTime: 30_000,
  });

  const isFollowing = following ?? profile?.following ?? false;

  const handleFollow = async () => {
    if (!profile) return;
    const next = !isFollowing;
    setFollowing(next);
    try {
      await fetch(`${API_BASE}/api/users/${userId}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
    } catch {
      setFollowing(!next);
    }
  };

  const TAB_LABELS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "posts", label: "Posts", icon: "edit-3" },
    { key: "pitches", label: "Projects", icon: "zap" },
    { key: "circles", label: "Circles", icon: "users" },
  ];

  const posts = userPosts ?? [];
  const pitches = profile?.pitches ?? [];
  const circles = profile?.circles ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>
          {profile?.name ?? "Profile"}
        </Text>
        <Pressable onPress={() => profile && router.push(`/chat/${userId}`)} hitSlop={10} style={({ pressed }) => [styles.msgTopBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="message-circle" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {isLoading || !profile ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={tab === "posts" ? posts : []}
          keyExtractor={(p: any) => p.id}
          renderItem={({ item }) => <PostCard post={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          ListHeaderComponent={
            <View>
              {/* Hero */}
              <View style={[styles.hero, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={styles.heroTop}>
                  <Avatar avatarKey={profile.avatarKey} size={80} ring />
                  <View style={styles.heroActions}>
                    <Pressable onPress={handleFollow} style={({ pressed }) => [styles.followBtn, {
                      backgroundColor: isFollowing ? colors.cardElevated : colors.primary,
                      borderColor: isFollowing ? colors.border : colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    }]}>
                      <Feather name={isFollowing ? "user-check" : "user-plus"} size={14} color={isFollowing ? colors.foreground : colors.primaryForeground} />
                      <Text style={[styles.followBtnText, { color: isFollowing ? colors.foreground : colors.primaryForeground }]}>
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => router.push(`/chat/${userId}`)} style={({ pressed }) => [styles.msgBtn, { backgroundColor: colors.cardElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                      <Feather name="message-circle" size={16} color={colors.foreground} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.nameBlock}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
                    {profile.verified && <Feather name="check-circle" size={15} color={colors.primary} />}
                  </View>
                  <Text style={[styles.handle, { color: colors.mutedForeground }]}>@{profile.handle}</Text>
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.location, { color: colors.mutedForeground }]}>{profile.city}, {profile.country}</Text>
                  </View>
                  {profile.bio ? (
                    <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
                  ) : null}
                </View>

                <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                  <StatPill value={profile.followersCount.toLocaleString()} label="Followers" colors={colors} />
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <StatPill value={profile.title || "—"} label="Role" colors={colors} />
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <StatPill value={profile.company || "—"} label="Company" colors={colors} />
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <StatPill value={pitches.length.toString()} label="Projects" colors={colors} accent={colors.primary} />
                </View>
              </View>

              {/* Tab bar */}
              <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                {TAB_LABELS.map((t) => (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, { borderBottomColor: tab === t.key ? colors.primary : "transparent" }]}>
                    <Feather name={t.icon} size={14} color={tab === t.key ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
                    <View style={[styles.tabBadge, { backgroundColor: colors.cardElevated }]}>
                      <Text style={[styles.tabBadgeText, { color: colors.mutedForeground }]}>
                        {t.key === "posts" ? posts.length : t.key === "pitches" ? pitches.length : circles.length}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Pitches tab content */}
              {tab === "pitches" && (
                <View style={{ padding: 16, gap: 12 }}>
                  {pitches.length === 0 ? (
                    <EmptyState icon="zap" title="No projects yet" sub="This user hasn't published any pitches." colors={colors} />
                  ) : pitches.map((p) => (
                    <Pressable key={p.id} onPress={() => router.push(`/pitch/${p.id}`)} style={({ pressed }) => [styles.pitchCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
                      <View style={styles.pitchCardTop}>
                        <View style={[styles.pitchIcon, { backgroundColor: colors.primary + "20" }]}>
                          <Feather name="zap" size={14} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pitchTitle, { color: colors.foreground }]}>{p.title}</Text>
                          <Text style={[styles.pitchMeta, { color: colors.mutedForeground }]}>{p.stage} · {p.industry} · {p.city}</Text>
                        </View>
                        {(p as any).verified && (
                          <View style={[styles.verifiedBadge, { backgroundColor: colors.success + "20", borderColor: colors.success }]}>
                            <Feather name="check" size={10} color={colors.success} />
                            <Text style={[styles.verifiedText, { color: colors.success }]}>Verified</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.pitchSummary, { color: colors.mutedForeground }]} numberOfLines={2}>{p.summary}</Text>
                      <View style={styles.pitchProgress}>
                        <View style={[styles.progressBar, { backgroundColor: colors.cardElevated }]}>
                          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.min(100, Math.round((p.raised / p.raising) * 100))}%` }]} />
                        </View>
                        <View style={styles.pitchStats}>
                          <Text style={[styles.pitchStatText, { color: colors.foreground }]}>{formatPi(p.raised)} raised</Text>
                          <Text style={[styles.pitchStatText, { color: colors.mutedForeground }]}>{p.backersCount} backers</Text>
                        </View>
                      </View>
                      {Array.isArray((p as any).requirements) && (p as any).requirements.length > 0 && (
                        <View style={[styles.requirementsBox, { backgroundColor: colors.accent + "10", borderColor: colors.accent + "30" }]}>
                          <Text style={[styles.requirementsTitle, { color: colors.accent }]}>What we need:</Text>
                          {(p as any).requirements.slice(0, 3).map((r: any, i: number) => (
                            <View key={i} style={styles.reqRow}>
                              <Feather name="check-square" size={12} color={colors.accent} />
                              <Text style={[styles.reqText, { color: colors.foreground }]}><Text style={{ fontFamily: "Inter_700Bold" }}>{r.type}</Text> — {r.description}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Circles tab content */}
              {tab === "circles" && (
                <View style={{ padding: 16, gap: 10 }}>
                  {circles.length === 0 ? (
                    <EmptyState icon="users" title="No circles yet" sub="This user hasn't joined any circles." colors={colors} />
                  ) : circles.map((c) => (
                    <Pressable key={c.id} onPress={() => router.push(`/circle/${c.id}`)} style={({ pressed }) => [styles.circleCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
                      <View style={[styles.circleColor, { backgroundColor: c.color + "30", borderColor: c.color }]}>
                        <Feather name="users" size={13} color={c.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.circleName, { color: colors.foreground }]}>{c.name}</Text>
                        <Text style={[styles.circleMeta, { color: colors.mutedForeground }]}>{c.membersCount} members · {c.category}</Text>
                      </View>
                      {c.paid && (
                        <View style={[styles.paidBadge, { backgroundColor: colors.sponsor + "20", borderColor: colors.sponsor }]}>
                          <Text style={[styles.paidText, { color: colors.sponsor }]}>PRO</Text>
                        </View>
                      )}
                      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Posts empty state */}
              {tab === "posts" && posts.length === 0 && (
                <View style={{ padding: 16 }}>
                  <EmptyState icon="edit-3" title="No posts yet" sub="This user hasn't shared anything yet." colors={colors} />
                </View>
              )}

              {/* Posts header spacing */}
              {tab === "posts" && posts.length > 0 && <View style={{ height: 12 }} />}
            </View>
          }
          ListEmptyComponent={null}
        />
      )}
    </View>
  );
}

function EmptyState({ icon, title, sub, colors }: {
  icon: keyof typeof Feather.glyphMap; title: string; sub: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[es.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[es.iconWrap, { backgroundColor: colors.cardElevated }]}>
        <Feather name={icon} size={22} color={colors.mutedForeground} />
      </View>
      <Text style={[es.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[es.sub, { color: colors.mutedForeground }]}>{sub}</Text>
    </View>
  );
}
const es = StyleSheet.create({
  wrap: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 4 },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});

function StatPill({ value, label, colors, accent }: { value: string; label: string; colors: ReturnType<typeof useColors>; accent?: string }) {
  return (
    <View style={sp.wrap}>
      <Text style={[sp.value, { color: accent ?? colors.foreground }]} numberOfLines={1}>{value}</Text>
      <Text style={[sp.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}
const sp = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  value: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  label: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  msgTopBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { padding: 20, borderBottomWidth: 1 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  nameBlock: { marginTop: 14, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  handle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 12, fontFamily: "Inter_500Medium" },
  bio: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular", marginTop: 4 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  statDivider: { width: 1, height: 28 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  followBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  msgBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  pitchCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  pitchCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  pitchIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pitchTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  pitchMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  pitchSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  verifiedText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  pitchProgress: { gap: 6 },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  pitchStats: { flexDirection: "row", justifyContent: "space-between" },
  pitchStatText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  requirementsBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  requirementsTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3, marginBottom: 2 },
  reqRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  reqText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  circleCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  circleColor: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  circleName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  circleMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  paidBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  paidText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
});
