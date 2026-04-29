import { Feather } from "@expo/vector-icons";
import {
  getListUsersQueryKey,
  useListCircles,
  useListPosts,
  useListUsers,
  useToggleFollow,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CURRENT_USER_ID } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/lib/userCache";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const me = useCurrentUser();
  const { data: users } = useListUsers();
  const { data: posts } = useListPosts();
  const { data: circles } = useListCircles();

  const allPosts = posts ?? [];
  const allCircles = circles ?? [];
  const allUsers = users ?? [];

  const myPosts = allPosts.filter((p) => p.authorId === CURRENT_USER_ID).length;
  const totalTips = allPosts.reduce(
    (s, p) => s + (p.authorId === CURRENT_USER_ID ? p.tipsTotal : 0),
    0,
  );
  const followingCount = allUsers.filter((u) => u.following).length;
  const joinedCircles = allCircles.filter((c) => c.joined).length;
  const monthlySpend = allCircles
    .filter((c) => c.joined && c.paid)
    .reduce((s, c) => s + c.price, 0);

  const suggested = allUsers.filter(
    (u) => u.id !== CURRENT_USER_ID && !u.following,
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.cover,
          {
            backgroundColor: colors.card,
            paddingTop: topPad + 24,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.coverTop}>
          <Avatar avatarKey={me.avatarKey} size={84} ring />
          <View style={styles.coverActions}>
            <Pressable
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="share-2" size={16} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="settings" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {me.name}
            </Text>
            {me.verified ? (
              <Feather
                name="check-circle"
                size={16}
                color={colors.primary}
                style={{ marginLeft: 6 }}
              />
            ) : null}
          </View>
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>
            @{me.handle}
          </Text>
          <Text style={[styles.bio, { color: colors.foreground }]}>
            {me.bio}
            {"\n"}
            <Text style={{ color: colors.mutedForeground }}>
              {me.city}, {me.country}
            </Text>
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Followers" value={me.followersCount.toLocaleString()} />
          <Divider />
          <Stat label="Following" value={followingCount.toString()} />
          <Divider />
          <Stat label="Circles" value={joinedCircles.toString()} />
          <Divider />
          <Stat
            label="Tips earned"
            value={"$" + totalTips.toLocaleString()}
            accent={colors.tip}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Quick actions
        </Text>
        <View style={styles.actionGrid}>
          <ActionTile icon="edit-3" label="Compose" color={colors.primary} />
          <ActionTile
            icon="dollar-sign"
            label={`$${monthlySpend}/mo`}
            color={colors.tip}
            sub="Spend"
          />
          <ActionTile icon="briefcase" label="My pitch" color={colors.accent} />
          <ActionTile
            icon="mail"
            label="Messages"
            color={colors.sponsor}
            onPress={() => router.push("/inbox")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Suggested to follow
          </Text>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>
            See all
          </Text>
        </View>
        {suggested.map((u) => (
          <SuggestedRow key={u.id} userId={u.id} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Activity
        </Text>
        <View
          style={[
            styles.activityCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ActivityRow
            icon="edit-3"
            color={colors.accent}
            label={`${myPosts} post${myPosts === 1 ? "" : "s"} this week`}
            meta="+24% engagement"
          />
          <ActivityRow
            icon="repeat"
            color={colors.success}
            label="142 reposts on your work"
            meta="Across 3 timezones"
          />
          <ActivityRow
            icon="map-pin"
            color={colors.primary}
            label="11 connections within 20km"
            meta={me.city}
            last
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SuggestedRow({ userId }: { userId: string }) {
  const colors = useColors();
  const { data: users } = useListUsers();
  const u = (users ?? []).find((x) => x.id === userId);
  const queryClient = useQueryClient();
  const follow = useToggleFollow();
  if (!u) return null;
  return (
    <View
      style={[
        styles.userRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Avatar avatarKey={u.avatarKey} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.userName, { color: colors.foreground }]}>
          {u.name}
        </Text>
        <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>
          {u.title} · {u.city}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push(`/chat/${u.id}`)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.contactIcon,
          {
            backgroundColor: colors.cardElevated,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name="message-circle"
          size={14}
          color={colors.foreground}
        />
      </Pressable>
      <Pressable
        onPress={() =>
          follow.mutate(
            { id: u.id },
            {
              onSuccess: () =>
                queryClient.invalidateQueries({
                  queryKey: getListUsersQueryKey(),
                }),
            },
          )
        }
        style={({ pressed }) => [
          styles.followBtn,
          {
            backgroundColor: u.following
              ? colors.cardElevated
              : colors.foreground,
            borderColor: u.following ? colors.border : colors.foreground,
            borderWidth: 1,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.followText,
            { color: u.following ? colors.foreground : colors.background },
          ]}
        >
          {u.following ? "Following" : "Follow"}
        </Text>
      </Pressable>
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statValue, { color: accent ?? colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function ActionTile({
  icon,
  label,
  color,
  sub,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  sub?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + "1F" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ActivityRow({
  icon,
  color,
  label,
  meta,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  label: string;
  meta: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.activityRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.activityIcon, { backgroundColor: color + "1F" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.activityLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.activityMeta, { color: colors.mutedForeground }]}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  coverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nameBlock: { marginTop: 16 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  handle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  bio: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 14,
  },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  divider: { width: 1, height: 28 },
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  sectionAction: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actionGrid: { flexDirection: "row", gap: 10 },
  actionTile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  actionSub: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  userName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  userMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  followText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  activityCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  activityLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  activityMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
