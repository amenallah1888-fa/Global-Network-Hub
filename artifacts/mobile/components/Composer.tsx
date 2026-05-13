import { Feather } from "@expo/vector-icons";
import {
  getListPostsQueryKey,
  useCreatePost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  Alert,
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

  const handleImage = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Image upload", "Image picking is available on the mobile app.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach images to posts.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Alert.alert("Image selected", "Image attachment will be linked to posts in the next update.");
    }
  };

  const handlePoll = () => {
    Alert.alert("Create a Poll", "Polls are coming soon — stay tuned!", [{ text: "OK" }]);
  };

  const handleLocation = () => {
    Alert.alert("Share Location", "Location tagging is coming soon!", [{ text: "OK" }]);
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
          <IconBtn name="image" color={colors.mutedForeground} onPress={handleImage} />
          <IconBtn name="bar-chart-2" color={colors.mutedForeground} onPress={handlePoll} />
          <IconBtn name="map-pin" color={colors.mutedForeground} onPress={handleLocation} />
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
  onPress,
}: {
  name: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      hitSlop={6}
      onPress={onPress}
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
