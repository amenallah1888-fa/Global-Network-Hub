import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { currentUser, users } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const { posts, followingIds, circles } = useApp();

  const myPosts = posts.filter((p) => p.authorId === currentUser.id).length;
  const totalTips = posts.reduce((s, p) => s + (p.authorId === currentUser.id ? p.tips : 0), 0);
  const suggestedFollow = users.filter(
    (u) => u.id !== currentUser.id && !followingIds.includes(u.id),
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
          <Avatar source={currentUser.avatar} size={84} ring />
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
              {currentUser.name}
            </Text>
            {currentUser.verified ? (
              <Feather
                name="check-circle"
                size={16}
                color={colors.primary}
                style={{ marginLeft: 6 }}
              />
            ) : null}
          </View>
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>
            @{currentUser.handle}
          </Text>
          <Text style={[styles.bio, { color: colors.foreground }]}>
            {currentUser.title} at {currentUser.company}. Building autonomous wet labs.
            {"\n"}
            <Text style={{ color: colors.mutedForeground }}>
              {currentUser.city}, {currentUser.country}
            </Text>
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Followers" value={currentUser.followers.toLocaleString()} />
          <Divider />
          <Stat label="Following" value={followingIds.length.toString()} />
          <Divider />
          <Stat label="Circles" value={circles.filter((c) => c.joined).length.toString()} />
          <Divider />
          <Stat
            label="Tips"
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
          <ActionTile icon="dollar-sign" label="Earnings" color={colors.tip} />
          <ActionTile icon="briefcase" label="My pitch" color={colors.accent} />
          <ActionTile icon="users" label="Invites" color={colors.sponsor} />
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
        {suggestedFollow.map((u) => (
          <View
            key={u.id}
            style={[
              styles.userRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Avatar source={u.avatar} size={42} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {u.name}
              </Text>
              <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>
                {u.title} · {u.city}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.followBtn,
                {
                  backgroundColor: colors.foreground,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.followText, { color: colors.background }]}>
                Follow
              </Text>
            </Pressable>
          </View>
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
            meta="San Francisco"
            last
          />
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
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
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <Pressable
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
  root: {
    flex: 1,
  },
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
  nameBlock: {
    marginTop: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
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
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 22,
  },
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
  actionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionTile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
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
