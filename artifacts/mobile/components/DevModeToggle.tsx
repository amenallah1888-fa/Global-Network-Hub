import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDevMode } from "@/context/DevModeContext";

export function DevModeToggle() {
  const { devMode, toggleDevMode } = useDevMode();
  const insets = useSafeAreaInsets();

  if (!__DEV__) return null;

  return (
    <Pressable
      onPress={toggleDevMode}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom: insets.bottom + 84,
          backgroundColor: devMode ? "#8B5CF6" : "#111827",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather name="terminal" size={13} color="#fff" />
      <Text style={styles.label}>{devMode ? "DEV MODE: ON" : "DEV MODE"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 999,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
