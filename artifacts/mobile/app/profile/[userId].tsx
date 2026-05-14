import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Circle, Pitch, User } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type PublicProfile = User & {
  pitches: Pitch[];
  circles: Circle[];
};

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [following, setFollowing] = useState<boolean | null>(null);

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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.cardElevated, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text
          style={[styles.topBarTitle, { color: colors.foreground }]}
          numberOfLines={1}
        >
          Profile
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading || !profile ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.hero,
              { backgroundColor: colors.card, borderBottomColor: colors.border },
            ]}
          >
            <Avatar avatarKey={profile.avatarKey} size={80} ring />
            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.foreground }]}>
                  {profile.name}
                </Text>
                {profile.verified && (
                  <Feather name="check-circle" size={15} color={colors.primary} />
                )}
              </View>
              <Text style={[styles.handle, { color: colors.mutedForeground }]}>
                @{profile.handle}
              </Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={[styles.location, { color: colors.mutedForeground }]}>
                  {profile.city}, {profile.country}
                </Text>
              </View>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                onPress={handleFollow}
                style={({ pressed }) => [
                  styles.followBtn,
                  {
                    backgroundColor: isFollowing ? colors.cardElevated : colors.primary,
                    borderColor: isFollowing ? colors.border : colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name={isFollowing ? "user-check" : "user-plus"}
                  size={14}
                  color={isFollowing ? colors.foreground : colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.followBtnText,
                    { color: isFollowing ? colors.foreground : colors.primaryForeground },
                  ]}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/chat/${userId}`)}
                style={({ pressed }) => [
                  styles.msgBtn,
                  {
                    backgroundColor: colors.cardElevated,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="message-circle" size={16} color={colors.foreground} />
              </Pressable>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.statsRow}>
              <StatPill
                value={profile.followersCount.toString()}
                label="Followers"
                colors={colors}
              />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <StatPill value={profile.title} label="Role" colors={colors} />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <StatPill value={profile.company} label="Company" colors={colors} />
            </View>

            {profile.bio ? (
              <View
                style={[
                  styles.bioCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.bio, { color: colors.foreground }]}>
                  {profile.bio}
                </Text>
              </View>
            ) : null}

            {profile.circles && profile.circles.length > 0 && (
              <Section title="Circles" colors={colors}>
                {profile.circles.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.circleRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.circleColor,
                        { backgroundColor: c.color + "33", borderColor: c.color },
                      ]}
                    >
                      <Feather name="users" size={13} color={c.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.circleName, { color: colors.foreground }]}>
                        {c.name}
                      </Text>
                      <Text style={[styles.circleMeta, { color: colors.mutedForeground }]}>
                        {c.membersCount} members · {c.category}
                      </Text>
                    </View>
                    {c.paid && (
                      <View
                        style={[
                          styles.paidBadge,
                          { backgroundColor: colors.sponsor + "20", borderColor: colors.sponsor },
                        ]}
                      >
                        <Text style={[styles.paidText, { color: colors.sponsor }]}>PRO</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </Section>
            )}

            {profile.pitches && profile.pitches.length > 0 && (
              <Section title="Projects" colors={colors}>
                {profile.pitches.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/pitch/${p.id}`)}
                    style={({ pressed }) => [
                      styles.pitchRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.pitchIcon,
                        { backgroundColor: colors.primary + "20" },
                      ]}
                    >
                      <Feather name="zap" size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pitchTitle, { color: colors.foreground }]}>
                        {p.title}
                      </Text>
                      <Text
                        style={[styles.pitchMeta, { color: colors.mutedForeground }]}
                      >
                        {p.stage} · {formatMoney(p.raised)} raised
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </Section>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={[sectionStyles.title, { color: colors.foreground }]}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}
const sectionStyles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginBottom: 10 },
});

function StatPill({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={statPillStyles.wrap}>
      <Text style={[statPillStyles.value, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[statPillStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}
const statPillStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  value: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  label: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    alignItems: "center",
    padding: 24,
    gap: 12,
    borderBottomWidth: 1,
  },
  heroInfo: { alignItems: "center", gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  handle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontSize: 12, fontFamily: "Inter_500Medium" },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  followBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  msgBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  body: { padding: 20, gap: 0 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
  },
  statDivider: { width: 1, height: 32 },
  bioCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  bio: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  circleColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  circleName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  circleMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  paidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  paidText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  pitchRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  pitchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pitchTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pitchMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
});
