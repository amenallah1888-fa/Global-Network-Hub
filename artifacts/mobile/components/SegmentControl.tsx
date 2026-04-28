import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  scrollable?: boolean;
};

export function SegmentControl({ options, value, onChange, scrollable }: Props) {
  const colors = useColors();

  const inner = (
    <View
      style={[
        styles.row,
        scrollable
          ? { paddingHorizontal: 16 }
          : {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
              borderWidth: 1,
              padding: 4,
              borderRadius: 14,
              marginHorizontal: 16,
            },
      ]}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={({ pressed }) => [
              scrollable ? styles.chip : styles.tab,
              {
                backgroundColor: active
                  ? scrollable
                    ? colors.primary
                    : colors.card
                  : "transparent",
                borderColor: scrollable
                  ? active
                    ? colors.primary
                    : colors.border
                  : "transparent",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                scrollable ? styles.chipText : styles.tabText,
                {
                  color: active
                    ? scrollable
                      ? colors.primaryForeground
                      : colors.foreground
                    : colors.mutedForeground,
                },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {inner}
      </ScrollView>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
