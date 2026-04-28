import { Feather } from "@expo/vector-icons";
import {
  getListPostsQueryKey,
  useCreatePost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/lib/userCache";

export function Composer() {
  const colors = useColors();
  const me = useCurrentUser();
  const { composeText, setComposeText } = useApp();
  const queryClient = useQueryClient();
  const create = useCreatePost();

  const canPost = composeText.trim().length > 0 && !create.isPending;

  const handlePost = () => {
    if (!canPost) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    create.mutate(
      { data: { text: composeText.trim() } },
      {
        onSuccess: () => {
          setComposeText("");
          queryClient.invalidateQueries({
            queryKey: getListPostsQueryKey(),
            exact: false,
          });
        },
      },
    );
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Avatar avatarKey={me.avatarKey} size={40} />
      <TextInput
        value={composeText}
        onChangeText={setComposeText}
        placeholder="Share an insight, opportunity, or question…"
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={[styles.input, { color: colors.foreground }]}
      />
      <View style={styles.actions}>
        <View style={styles.iconRow}>
          <IconBtn name="image" color={colors.mutedForeground} />
          <IconBtn name="bar-chart-2" color={colors.mutedForeground} />
          <IconBtn name="map-pin" color={colors.mutedForeground} />
        </View>
        <Pressable
          disabled={!canPost}
          onPress={handlePost}
          style={({ pressed }) => [
            styles.post,
            {
              backgroundColor: canPost ? colors.primary : colors.cardElevated,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name="send"
            size={14}
            color={canPost ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

function IconBtn({
  name,
  color,
}: {
  name: keyof typeof Feather.glyphMap;
  color: string;
}) {
  return (
    <Pressable
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
    >
      <Feather name={name} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 40,
    maxHeight: 110,
    paddingTop: 8,
    paddingBottom: 4,
  },
  actions: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 56,
  },
  iconRow: {
    flexDirection: "row",
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  post: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
