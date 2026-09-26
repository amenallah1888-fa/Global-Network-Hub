import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, type AuthUser } from "@/context/AuthContext";
import { getApiBase } from "@/lib/apiBase";
import { useColors } from "@/hooks/useColors";

async function apiPost(path: string, body: Record<string, string>) {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error ?? "Request failed");
  return data as { token: string; user: AuthUser };
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSession } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    const value = identifier.trim().toLowerCase();
    const p = password;
    if (!value || !p) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      if (mode === "register") {
        const n = name.trim();
        if (!n) {
          Alert.alert("Missing name", "Please enter your display name.");
          setLoading(false);
          return;
        }
        if (!/^[a-z0-9_]{2,24}$/.test(value)) {
          Alert.alert("Invalid handle", "Use 2–24 lowercase letters, numbers, or underscores.");
          setLoading(false);
          return;
        }
        const { token, user } = await apiPost("/auth/register", { handle: value, name: n, password: p });
        await setSession(token, user);
      } else {
        const { token, user } = await apiPost("/auth/login", { handle: value, password: p });
        await setSession(token, user);
      }
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handlePiLogin = () => {
    Alert.alert(
      "Pi Network Auth",
      "Pi Network authentication requires opening this app inside the Pi Browser. Once you open it in Pi Browser, tap this button to sign in with your Pi account.",
      [{ text: "OK" }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View style={[styles.logoRing, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}>
            <Text style={[styles.logoEmoji]}>🌿</Text>
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>Oasis</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            The social business super app
          </Text>
        </View>

        <Pressable
          onPress={handlePiLogin}
          style={({ pressed }) => [
            styles.piBtn,
            { backgroundColor: "#7B3FE4", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.piBtnText}>π  Sign in with Pi Network</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
            or continue with account
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggle}>
            {(["login", "register"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: mode === m ? colors.primary : "transparent",
                    borderRadius: 10,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: mode === m ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {m === "login" ? "Sign In" : "Register"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field
            label={mode === "login" ? "Handle or email" : "Handle"}
            value={identifier}
            onChangeText={(v) => setIdentifier(mode === "login" ? v : v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder={mode === "login" ? "yourhandle or email" : "yourhandle"}
            autoCapitalize="none"
            colors={colors}
            keyboardType={mode === "login" ? "email-address" : "default"}
            prefix={mode === "register" ? "@" : undefined}
          />

          {mode === "register" && (
            <Field
              label="Display Name"
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              colors={colors}
            />
          )}

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, flex: 1 }]}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={6} style={{ padding: 8 }}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            testID="auth-submit"
            accessibilityRole="button"
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                {mode === "login" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </Pressable>

          {mode === "login" && (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Demo: handle <Text style={{ fontFamily: "Inter_600SemiBold" }}>alex</Text> · password{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>oasis123</Text>
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
  colors,
  prefix,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: TextInputProps["keyboardType"];
  colors: any;
  prefix?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        {prefix ? (
          <Text style={[styles.prefix, { color: colors.mutedForeground }]}>{prefix}</Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={autoCapitalize ?? "sentences"}
          keyboardType={keyboardType}
          style={[styles.input, { color: colors.foreground, flex: 1 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  brand: { alignItems: "center", marginBottom: 36 },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoEmoji: { fontSize: 34 },
  appName: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  piBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  piBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: "transparent",
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
  },
  toggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  prefix: { fontSize: 15, fontFamily: "Inter_400Regular", marginRight: 2 },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  hint: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
