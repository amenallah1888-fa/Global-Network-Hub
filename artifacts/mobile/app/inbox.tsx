import { Feather } from "@expo/vector-icons";
import { useListConversations } from "@workspace/api-client-react";
import { router, Stack } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const days = Math.floor(h / 24);
  if (days < 7) return days + "d";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const { data, isLoading } = useListConversations({
    query: { refetchInterval: 8000, staleTime: 4000 } as any,
  });
  const list = data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingTop: topPad + 8,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Messages
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {list.length === 0
              ? "Start a conversation from any profile or pitch"
              : `${list.length} ${list.length === 1 ? "thread" : "threads"}`}
          </Text>
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(c) => c.peerId}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const unread = item.unread > 0;
          return (
            <Pressable
              onPress={() => router.push(`/chat/${item.peerId}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Avatar avatarKey={item.peer.avatarKey} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.rowTop}>
                  <Text
                    style={[styles.name, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.peer.name}
                  </Text>
                  <Text
                    style={[
                      styles.time,
                      {
                        color: unread ? colors.primary : colors.mutedForeground,
                        fontFamily: unread
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                      },
                    ]}
                  >
                    {timeAgo(item.lastMessage.createdAt)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[
                      styles.preview,
                      {
                        color: unread
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: unread
                          ? "Inter_600SemiBold"
                          : "Inter_400Regular",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessage.fromUserId === item.peerId ? "" : "You: "}
                    {item.lastMessage.text}
                  </Text>
                  {unread ? (
                    <View
                      style={[styles.dot, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.dotText}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Feather
                  name="message-circle"
                  size={28}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No messages yet
              </Text>
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Tap "Contact" on any pitch or profile to start a conversation.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1 },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 13,
  },
  dot: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: {
    color: "#0A0B0F",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 48,
    gap: 10,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
});
