import { Feather } from "@expo/vector-icons";
import {
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  useListMessages,
  useSendMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CURRENT_USER_ID } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useUserById } from "@/lib/userCache";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const peer = useUserById(userId);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState("");

  const { data, isLoading } = useListMessages(userId, {
    query: { refetchInterval: 6000, staleTime: 2000 } as any,
  });
  const messages = data ?? [];

  const send = useSendMessage();

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [messages.length]);

  const onSend = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setText("");
    send.mutate(
      { userId, data: { text: t } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListMessagesQueryKey(userId),
          });
          queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
        },
        onError: () => {
          setText(t);
        },
      },
    );
  };

  // Build day-separator-aware items
  const items: Array<
    | { kind: "day"; key: string; label: string }
    | { kind: "msg"; key: string; msg: (typeof messages)[number] }
  > = [];
  let lastDay = "";
  for (const m of messages) {
    const day = formatDay(m.createdAt);
    if (day !== lastDay) {
      items.push({ kind: "day", key: "d-" + day + "-" + m.id, label: day });
      lastDay = day;
    }
    items.push({ kind: "msg", key: "m-" + m.id, msg: m });
  }

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
        <Avatar avatarKey={peer.avatarKey} size={36} />
        <View style={styles.titleWrap}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {peer.name}
            </Text>
            {peer.verified ? (
              <Feather
                name="check-circle"
                size={14}
                color={colors.primary}
                style={{ marginLeft: 4 }}
              />
            ) : null}
          </View>
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {peer.title}
            {peer.company ? ` · ${peer.company}` : ""}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading && messages.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
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
              Say hi to {peer.name.split(" ")[0]}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Your conversation will be saved here.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(it) => it.key}
            contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 12 }}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => {
              if (item.kind === "day") {
                return (
                  <View style={styles.dayRow}>
                    <Text
                      style={[
                        styles.dayLabel,
                        {
                          color: colors.mutedForeground,
                          backgroundColor: colors.cardElevated,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              }
              const mine = item.msg.fromUserId === CURRENT_USER_ID;
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    { justifyContent: mine ? "flex-end" : "flex-start" },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? {
                            backgroundColor: colors.primary,
                            borderBottomRightRadius: 4,
                          }
                        : {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderBottomLeftRadius: 4,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        {
                          color: mine
                            ? colors.primaryForeground
                            : colors.foreground,
                        },
                      ]}
                    >
                      {item.msg.text}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleMeta,
                        {
                          color: mine
                            ? colors.primaryForeground + "B0"
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {formatTime(item.msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${peer.name.split(" ")[0]}…`}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={onSend}
              disabled={!text.trim() || send.isPending}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: text.trim()
                    ? colors.primary
                    : colors.cardElevated,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name="send"
                size={16}
                color={
                  text.trim() ? colors.primaryForeground : colors.mutedForeground
                }
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  nameRow: { flexDirection: "row", alignItems: "center" },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 48,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  dayRow: {
    alignItems: "center",
    marginVertical: 10,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 3,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  bubbleMeta: {
    fontSize: 10,
    marginTop: 4,
    fontFamily: "Inter_500Medium",
    alignSelf: "flex-end",
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 8,
    maxHeight: 120,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
