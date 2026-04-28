import { Image, StyleSheet, View } from "react-native";

import { getAvatar } from "@/lib/imageMap";
import { useColors } from "@/hooks/useColors";

type Props = {
  source?: any;
  avatarKey?: string | null;
  size?: number;
  ring?: boolean;
};

export function Avatar({ source, avatarKey, size = 40, ring = false }: Props) {
  const colors = useColors();
  const finalSource = source ?? getAvatar(avatarKey);
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
