import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MapMarker, mapMarkers } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const ICONS: Record<MapMarker["type"], keyof typeof Feather.glyphMap> = {
  person: "user",
  business: "briefcase",
  project: "zap",
};

const MAP_HEIGHT = 380;

type Props = {
  filter: MapMarker["type"] | "all";
};

export function NexusMap({ filter }: Props) {
  const colors = useColors();
  const [selected, setSelected] = useState<MapMarker | null>(mapMarkers[2] ?? null);

  const onPick = (m: MapMarker) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelected(m);
  };

  const visible = mapMarkers.filter((m) => filter === "all" || m.type === filter);

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
        <View style={[styles.tint, { backgroundColor: colors.background + "55" }]} />

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
                  backgroundColor: isSelected ? accent : colors.background + "EE",
                  transform: [
                    { translateX: -16 },
                    { translateY: -16 },
                    { scale: isSelected ? 1.08 : 1 },
                  ],
                },
              ]}
            >
              <Feather
                name={ICONS[m.type]}
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

      {selected ? (
        <View
          style={[
            styles.detail,
            { backgroundColor: colors.cardElevated, borderTopColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.detailIcon,
              {
                backgroundColor:
                  (selected.type === "person"
                    ? colors.accent
                    : selected.type === "business"
                      ? colors.primary
                      : colors.sponsor) + "1F",
              },
            ]}
          >
            <Feather
              name={ICONS[selected.type]}
              size={16}
              color={
                selected.type === "person"
                  ? colors.accent
                  : selected.type === "business"
                    ? colors.primary
                    : colors.sponsor
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: colors.foreground }]}>
              {selected.label}
            </Text>
            <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>
              {selected.city} · {selected.meta}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.detailBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[styles.detailBtnText, { color: colors.primaryForeground }]}
            >
              Connect
            </Text>
          </Pressable>
        </View>
      ) : null}
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
  detail: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderTopWidth: 1,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  detailMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  detailBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  detailBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
