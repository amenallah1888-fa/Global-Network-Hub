import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastProps = {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
};

export function Toast({ message, type = "success", visible, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(translateY, { toValue: -120, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 3200);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const CONFIG: Record<ToastType, { bg: string; icon: "check-circle" | "x-circle" | "info" | "alert-triangle" }> = {
    success: { bg: "#22C55E", icon: "check-circle" },
    error:   { bg: "#EF4444", icon: "x-circle" },
    info:    { bg: "#6366F1", icon: "info" },
    warning: { bg: "#F59E0B", icon: "alert-triangle" },
  };
  const cfg = CONFIG[type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { backgroundColor: cfg.bg, top: insets.top + 12, opacity, transform: [{ translateY }] },
      ]}
    >
      <Feather name={cfg.icon} size={16} color="#fff" />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    lineHeight: 20,
  },
});
