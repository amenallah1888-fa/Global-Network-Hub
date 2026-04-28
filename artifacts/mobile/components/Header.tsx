import { Feather } from "@expo/vector-icons";
import {
  getListNotificationsQueryKey,
  useListNotifications,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/lib/userCache";

type Props = {
  title: string;
  subtitle?: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
};

export function Header({
  title,
  subtitle,
  rightIcon,
  onRightPress,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifs } = useListNotifications({
    query: { refetchInterval: 8000, staleTime: 4000 } as any,
  });
  const unread = (notifs ?? []).filter((n) => !n.read).length;

  const showCustomRight = Boolean(rightIcon);
  const handleBellPress = () => {
    setNotifOpen(true);
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  return (
    <>
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingTop: topPad + 8,
          },
        ]}
      >
        <Avatar avatarKey={me.avatarKey} size={36} />
        <View style={styles.titleWrap}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showCustomRight ? (
          <Pressable
            onPress={onRightPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                marginRight: 8,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name={rightIcon} size={18} color={colors.foreground} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleBellPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Feather name="bell" size={18} color={colors.foreground} />
          {unread > 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <NotificationsSheet
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  badgeText: {
    color: "#0A0B0F",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
