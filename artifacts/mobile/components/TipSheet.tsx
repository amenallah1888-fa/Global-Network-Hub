import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const PRESETS = [1, 5, 20, 100];

type Props = {
  visible: boolean;
  authorName: string;
  onClose: () => void;
  onTip: (amount: number) => void;
};

export function TipSheet({ visible, authorName, onClose, onTip }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={40}
            tint={scheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.tip + "20" },
              ]}
            >
              <Feather name="dollar-sign" size={18} color={colors.tip} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Send a tip
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Reward {authorName} for valuable insight.
            </Text>
          </View>

          <View style={styles.amounts}>
            {PRESETS.map((amount) => (
              <Pressable
                key={amount}
                onPress={() => onTip(amount)}
                style={({ pressed }) => [
                  styles.amount,
                  {
                    backgroundColor: colors.cardElevated,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={[styles.amountValue, { color: colors.foreground }]}>
                  ${amount}
                </Text>
                <Text
                  style={[styles.amountLabel, { color: colors.mutedForeground }]}
                >
                  {amount === 1
                    ? "Coffee"
                    : amount === 5
                      ? "Espresso"
                      : amount === 20
                        ? "Lunch"
                        : "Dinner"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { borderColor: colors.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  amounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  amount: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    alignItems: "center",
  },
  amountValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  amountLabel: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  cancel: {
    borderTopWidth: 1,
    paddingTop: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
