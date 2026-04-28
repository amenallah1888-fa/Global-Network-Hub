import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { currentUser } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

type Props = {
  title: string;
  subtitle?: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
};

export function Header({ title, subtitle, rightIcon = "bell", onRightPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
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
      <Avatar source={currentUser.avatar} size={36} />
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
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
      <Pressable
        onPress={onRightPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.iconBtn,
          { borderColor: colors.border, backgroundColor: colors.card },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Feather name={rightIcon} size={18} color={colors.foreground} />
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      </Pressable>
    </View>
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
  dot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
