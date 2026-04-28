import { Feather } from "@expo/vector-icons";
import { useListMarkers, type Marker } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  person: "user",
  business: "briefcase",
  project: "zap",
};

const MAP_HEIGHT = 380;

type Props = {
  filter: Marker["type"] | "all";
  selected: Marker | null;
  onSelect: (m: Marker) => void;
};

export function AtlasMap({ filter, selected, onSelect }: Props) {
  const colors = useColors();
  const { data: markers } = useListMarkers({
    query: { staleTime: 60_000 } as any,
  });

  const visible = (markers ?? []).filter(
    (m) => filter === "all" || m.type === filter,
  );

  const onPick = (m: Marker) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onSelect(m);
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ImageBackground
        source={require("../assets/images/map_bg.png")}
        style={styles.map}
        imageStyle={styles.mapImage}
        resizeMode="cover"
      >
        <View
          style={[styles.tint, { backgroundColor: colors.background + "55" }]}
        />

        {visible.map((m) => {
          const isSelected = selected?.id === m.id;
          const accent =
            m.type === "person"
              ? colors.accent
              : m.type === "business"
                ? colors.primary
                : colors.sponsor;
          return (
            <Pressable
              key={m.id}
              onPress={() => onPick(m)}
              style={[
                styles.marker,
                {
                  left: `${m.x * 100}%`,
                  top: `${m.y * 100}%`,
                  borderColor: accent,
                  backgroundColor: isSelected
                    ? accent
                    : colors.background + "EE",
                  transform: [
                    { translateX: -16 },
                    { translateY: -16 },
                    { scale: isSelected ? 1.15 : 1 },
                  ],
                },
              ]}
            >
              <Feather
                name={ICONS[m.type] ?? "circle"}
                size={13}
                color={isSelected ? colors.primaryForeground : accent}
              />
              {isSelected ? null : (
                <View style={[styles.pulse, { backgroundColor: accent }]} />
              )}
            </Pressable>
          );
        })}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: MAP_HEIGHT,
    position: "relative",
  },
  mapImage: {
    opacity: 0.92,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.18,
    zIndex: -1,
  },
});
