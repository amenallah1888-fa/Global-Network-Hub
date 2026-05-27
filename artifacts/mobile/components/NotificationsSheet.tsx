import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkAllNotificationsRead,
  type Notification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { useUserById } from "@/lib/userCache";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ICON: Record<string, keyof typeof Feather.glyphMap> = {
  like: "heart",
  retweet: "repeat",
  tip: "zap",
  follow: "user-plus",
  circle_join: "users",
  circle_invite: "lock",
  pitch_backed: "briefcase",
};

const ICON_COLOR: Record<string, "destructive" | "success" | "tip" | "accent" | "primary" | "sponsor"> = {
  like: "destructive",
  retweet: "success",
  tip: "tip",
  follow: "accent",
  circle_join: "primary",
  circle_invite: "tip",
  pitch_backed: "sponsor",
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

export function NotificationsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListNotifications();
  const markAll = useMarkAllNotificationsRead();
  const items = data ?? [];

  useEffect(() => {
    if (visible && items.some((n) => !n.read)) {
      const t = setTimeout(() => {
        markAll.mutate(undefined, {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListNotificationsQueryKey(),
            });
          },
        });
      }, 1200);
      return () => clearTimeout(t);
    }
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={30}
            tint={scheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.overlay },
            ]}
          />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 24),
              maxHeight: "80%",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Notifications
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Loading…
              </Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell-off" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                You're all caught up
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Likes, tips, and circle activity will show up here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(n) => String(n.id)}
              renderItem={({ item }) => (
                <NotifRow notif={item} colors={colors} />
              )}
              ItemSeparatorComponent={() => (
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function NotifRow({
  notif,
  colors,
}: {
  notif: Notification;
  colors: ReturnType<typeof useColors>;
}) {
  const actor = useUserById(notif.actorId ?? null);
  const iconName = ICON[notif.type] ?? "bell";
  const accentKey = ICON_COLOR[notif.type] ?? "primary";
  const accent = (colors as any)[accentKey] as string;

  return (
    <View
      style={[
        styles.row,
        !notif.read && { backgroundColor: colors.cardElevated },
      ]}
    >
      <View style={styles.rowLeft}>
        {notif.actorId ? (
          <Avatar avatarKey={actor.avatarKey} size={36} />
        ) : (
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: accent + "1F" },
            ]}
          >
            <Feather name={iconName} size={16} color={accent} />
          </View>
        )}
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: accent, borderColor: colors.card },
          ]}
        >
          <Feather name={iconName} size={9} color={colors.background} />
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.message, { color: colors.foreground }]}>
          {notif.actorId ? (
            <Text style={{ fontFamily: "Inter_700Bold" }}>{actor.name} </Text>
          ) : null}
          {notif.message}
        </Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatRelative(notif.createdAt)}
        </Text>
      </View>
      {!notif.read ? (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowLeft: {
    position: "relative",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
});
