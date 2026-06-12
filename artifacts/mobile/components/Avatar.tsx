import { Image, StyleSheet, Text, View } from "react-native";

import { getAvatar } from "@/lib/imageMap";
import { useColors } from "@/hooks/useColors";
import { TIER_COLOR } from "@/lib/useAvatarData";

type Props = {
  source?: any;
  avatarKey?: string | null;
  size?: number;
  ring?: boolean;
  level?: number;
  skinTier?: string;
};

export function Avatar({ source, avatarKey, size = 40, ring = false, level, skinTier }: Props) {
  const colors = useColors();
  const finalSource = source ?? getAvatar(avatarKey);
  const badgeColor = skinTier ? (TIER_COLOR[skinTier.toLowerCase()] ?? TIER_COLOR.common) : colors.primary;
  const showBadge = typeof level === "number" && level > 0;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size + (ring ? 4 : 0),
          height: size + (ring ? 4 : 0),
          borderRadius: (size + (ring ? 4 : 0)) / 2,
          padding: ring ? 2 : 0,
          backgroundColor: ring ? colors.primary : "transparent",
        },
      ]}
    >
      <Image
        source={finalSource}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.cardElevated,
        }}
      />
      {showBadge && (
        <View
          style={[
            styles.levelBadge,
            {
              backgroundColor: badgeColor,
              minWidth: size <= 32 ? 14 : 18,
              height: size <= 32 ? 14 : 18,
              borderRadius: size <= 32 ? 7 : 9,
              bottom: ring ? 0 : -2,
              right: ring ? 0 : -2,
            },
          ]}
        >
          <Text style={[styles.levelText, { fontSize: size <= 32 ? 8 : 9 }]}>
            {level}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  levelText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    lineHeight: 11,
  },
});
