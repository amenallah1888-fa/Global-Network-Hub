import { Feather } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type Message = { role: "user" | "assistant"; content: string; id: string };
type PitchContext = Record<string, unknown> | null;

const SUGGESTIONS = [
  "Top 3 most funded projects?",
  "Trending cities on the Atlas?",
  "Latest service apps available?",
  "How does the Pi ecosystem work?",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function AIAssistant({ pitchContext = null }: { pitchContext?: PitchContext }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim(), id: uid() };
    const assistantId = uid();
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          pitchContext,
        }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              full += parsed.content;
              const snapshot = full;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)),
              );
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, I couldn't reach the AI service. Please try again." }
              : m,
          ),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, shadowColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          { bottom: insets.bottom + 90 },
        ]}
      >
        <Text style={styles.fabIcon}>✦</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <KeyboardAvoidingView
          style={[styles.modal, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.aiOrb, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.aiOrbText, { color: colors.primary }]}>✦</Text>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>HumanVerse Intelligence</Text>
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                  {pitchContext ? "Analyzing current project" : "Ecosystem AI assistant"}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {messages.length > 0 && (
                <Pressable onPress={clearChat} hitSlop={10} style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}>
                  <Feather name="rotate-ccw" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
              <Pressable onPress={handleClose} hitSlop={10} style={({ pressed }) => [styles.headerBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
          </View>

          {messages.length === 0 ? (
            <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
              <View style={[styles.emptyOrb, { backgroundColor: colors.primary + "12" }]}>
                <Text style={[styles.emptyOrbText, { color: colors.primary }]}>✦</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>What can I help you with?</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                I have live access to every project, city, and service in the HumanVerse ecosystem.
              </Text>
              {pitchContext && (
                <Pressable
                  onPress={() => sendMessage("Analyze this project based on its roadmap and proof of reality.")}
                  style={({ pressed }) => [styles.analyzeBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Feather name="zap" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.analyzeBtnText, { color: colors.primaryForeground }]}>Analyze this project</Text>
                </Pressable>
              )}
              <View style={styles.suggestionsGrid}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => sendMessage(s)}
                    style={({ pressed }) => [styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item: msg }) => (
                <View style={[styles.msgRow, msg.role === "user" ? styles.msgRowUser : styles.msgRowAssistant]}>
                  {msg.role === "assistant" && (
                    <View style={[styles.msgAvatar, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.msgAvatarText, { color: colors.primary }]}>✦</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      msg.role === "user"
                        ? { backgroundColor: colors.primary, maxWidth: "80%" }
                        : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, flex: 1 },
                    ]}
                  >
                    {msg.role === "assistant" && msg.content === "" && streaming ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.bubbleText, { color: colors.mutedForeground }]}>Thinking…</Text>
                      </View>
                    ) : (
                      <Text style={[styles.bubbleText, { color: msg.role === "user" ? colors.primaryForeground : colors.foreground }]}>
                        {msg.content}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            />
          )}

          <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about projects, cities, services…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.inputField, {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
                ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
              }]}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
              editable={!streaming}
            />
            <Pressable
              onPress={streaming ? () => abortRef.current?.abort() : () => sendMessage(input)}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: streaming ? "#EF4444" : colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              {streaming
                ? <Feather name="square" size={14} color="#fff" />
                : <Feather name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  fabIcon: { fontSize: 22, color: "#fff", fontWeight: "bold" },
  modal: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  aiOrb: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  aiOrbText: { fontSize: 16, fontWeight: "bold" },
  headerTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  empty: { padding: 24, alignItems: "center", gap: 12, flexGrow: 1, justifyContent: "center" },
  emptyOrb: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyOrbText: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.4 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  analyzeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: 4 },
  analyzeBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  suggestionsGrid: { width: "100%", gap: 8, marginTop: 4 },
  suggestion: { padding: 14, borderRadius: 14, borderWidth: 1 },
  suggestionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  msgRow: { marginBottom: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 2 },
  msgAvatarText: { fontSize: 14 },
  bubble: { padding: 12, borderRadius: 16 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingTop: 8, borderTopWidth: 1 },
  inputField: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
