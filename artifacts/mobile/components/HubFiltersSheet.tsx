import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type FundingBand =
  | "any"
  | "lt500k"
  | "500k_2m"
  | "2m_10m"
  | "gt10m";

export type HubFilters = {
  industries: string[];
  cities: string[];
  funding: FundingBand;
};

export const EMPTY_FILTERS: HubFilters = {
  industries: [],
  cities: [],
  funding: "any",
};

const INDUSTRIES = [
  "BioTech",
  "AI",
  "Climate",
  "Robotics",
  "Commerce",
  "FinTech",
  "DeepTech",
  "Creative",
];

const CITIES = [
  "San Francisco",
  "New York",
  "London",
  "Berlin",
  "Stockholm",
  "Lagos",
  "Bengaluru",
  "Singapore",
  "Tokyo",
  "Sydney",
  "São Paulo",
  "Casablanca",
];

const FUNDING_OPTIONS: { value: FundingBand; label: string }[] = [
  { value: "any", label: "Any size" },
  { value: "lt500k", label: "Under $500K" },
  { value: "500k_2m", label: "$500K – $2M" },
  { value: "2m_10m", label: "$2M – $10M" },
  { value: "gt10m", label: "Over $10M" },
];

export function fundingBandMatches(raising: number, band: FundingBand) {
  switch (band) {
    case "any":
      return true;
    case "lt500k":
      return raising < 500_000;
    case "500k_2m":
      return raising >= 500_000 && raising <= 2_000_000;
    case "2m_10m":
      return raising > 2_000_000 && raising <= 10_000_000;
    case "gt10m":
      return raising > 10_000_000;
  }
}

export function activeFilterCount(f: HubFilters): number {
  return (
    f.industries.length +
    f.cities.length +
    (f.funding !== "any" ? 1 : 0)
  );
}

type Props = {
  visible: boolean;
  initial: HubFilters;
  onClose: () => void;
  onApply: (next: HubFilters) => void;
};

export function HubFiltersSheet({
  visible,
  initial,
  onClose,
  onApply,
}: Props) {
  const colors = useColors();
  const [draft, setDraft] = useState<HubFilters>(initial);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraft(initial);
      slide.setValue(0);
      Animated.spring(slide, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [visible, initial, slide]);

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];

  const handleReset = () => setDraft(EMPTY_FILTERS);

  const sheetTransform = {
    transform: [
      {
        translateY: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [Dimensions.get("window").height, 0],
        }),
      },
    ],
  };

  const count = activeFilterCount(draft);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.background },
            sheetTransform,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>
                FILTERS
              </Text>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Refine the deal flow
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconClose,
                {
                  backgroundColor: colors.cardElevated,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              INDUSTRY
            </Text>
            <View style={styles.chipWrap}>
              {INDUSTRIES.map((opt) => {
                const active = draft.industries.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        industries: toggle(d.industries, opt),
                      }))
                    }
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active
                            ? colors.primaryForeground
                            : colors.foreground,
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              FUNDING GOAL
            </Text>
            <View style={styles.chipWrap}>
              {FUNDING_OPTIONS.map((opt) => {
                const active = draft.funding === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() =>
                      setDraft((d) => ({ ...d, funding: opt.value }))
                    }
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active
                            ? colors.primaryForeground
                            : colors.foreground,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              LOCATION
            </Text>
            <View style={styles.chipWrap}>
              {CITIES.map((opt) => {
                const active = draft.cities.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        cities: toggle(d.cities, opt),
                      }))
                    }
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name="map-pin"
                      size={11}
                      color={
                        active
                          ? colors.primaryForeground
                          : colors.mutedForeground
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active
                            ? colors.primaryForeground
                            : colors.foreground,
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.resetBtn,
                {
                  borderColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.resetText, { color: colors.foreground }]}>
                Reset
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onApply(draft);
                onClose();
              }}
              style={({ pressed }) => [
                styles.applyBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.applyText,
                  { color: colors.primaryForeground },
                ]}
              >
                Apply{count > 0 ? ` · ${count}` : ""}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 12, 8, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "82%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  iconClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginTop: 14,
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  resetBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  applyBtn: {
    flex: 1,
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
