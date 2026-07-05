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

export type CoFounderMilestone = { title: string; description: string; percentageOfFunds: number };

export type CoFounderOptimizedState = {
  title: string;
  summary: string;
  raising: number;
  budgetNotes: string;
  milestones: CoFounderMilestone[];
  reasoning: string;
};

type Draft = {
  title?: string;
  summary?: string;
  industry?: string;
  stage?: string;
  raising?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  draft: Draft;
  onApply: (state: CoFounderOptimizedState) => void;
};

const STARTERS = [
  "Help me sharpen my title and summary",
  "What's a realistic raising amount for this idea?",
  "Break this project into milestones",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function CoFounderChatSheet({ visible, onClose, draft, onApply }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [optimized, setOptimized] = useState<CoFounderOptimizedState | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Message = { role: "user", content: text.trim(), id: uid() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/co-founder`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: text.trim(),
          draft,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.sessionId ?? sessionId);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply ?? "Here's what I found.", id: uid() },
        ]);
        if (data.optimizedState) setOptimized(data.optimizedState);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't process that. Please try again.", id: uid() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the AI Co-Founder service.", id: uid() },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const handleApply = () => {
    if (!optimized) return;
    onApply(optimized);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.modal, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.aiOrb, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="cpu" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>AI Co-Founder</Text>
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                Refine your pitch before publishing
              </Text>
            </View>
          </View>
          <Pressable onPress={handleClose} hitSlop={10} style={({ pressed }) => [styles.headerBtn, { backgroundColor: colors.cardElevated, opacity: pressed ? 0.6 : 1 }]}>
            <Feather name="x" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
            <View style={[styles.emptyOrb, { backgroundColor: colors.primary + "12" }]}>
              <Feather name="cpu" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Let's build your pitch</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Tell me about your project and I'll help refine the title, summary, raising goal, and milestone plan.
            </Text>
            <View style={styles.suggestionsGrid}>
              {STARTERS.map((s) => (
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
                    <Feather name="cpu" size={13} color={colors.primary} />
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
                  <Text style={[styles.bubbleText, { color: msg.role === "user" ? colors.primaryForeground : colors.foreground }]}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            )}
            ListFooterComponent={
              sending ? (
                <View style={[styles.msgRow, styles.msgRowAssistant]}>
                  <View style={[styles.msgAvatar, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="cpu" size={13} color={colors.primary} />
                  </View>
                  <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.bubbleText, { color: colors.mutedForeground }]}>Thinking…</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {optimized && (
          <View style={[styles.optimizedCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "40" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Feather name="check-circle" size={13} color={colors.primary} />
              <Text style={[styles.optimizedTitle, { color: colors.primary }]}>Optimized draft ready</Text>
            </View>
            <Text style={[styles.optimizedLine, { color: colors.foreground }]} numberOfLines={2}>{optimized.title}</Text>
            <Text style={[styles.optimizedMeta, { color: colors.mutedForeground }]}>
              {optimized.raising.toLocaleString()} π raise · {optimized.milestones.length} milestones
            </Text>
            <Pressable onPress={handleApply} style={({ pressed }) => [styles.applyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="zap" size={14} color={colors.primaryForeground} />
              <Text style={[styles.applyBtnText, { color: colors.primaryForeground }]}>Apply to draft</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Describe your project, ask for help…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.inputField, {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.border,
              ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
            }]}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            editable={!sending}
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={sending}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: colors.primary, opacity: pressed || sending ? 0.7 : 1 },
            ]}
          >
            <Feather name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  aiOrb: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  empty: { padding: 24, alignItems: "center", gap: 12, flexGrow: 1, justifyContent: "center" },
  emptyOrb: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.4 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  suggestionsGrid: { width: "100%", gap: 8, marginTop: 4 },
  suggestion: { padding: 14, borderRadius: 14, borderWidth: 1 },
  suggestionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  msgRow: { marginBottom: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 2 },
  bubble: { padding: 12, borderRadius: 16 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  optimizedCard: { marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  optimizedTitle: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  optimizedLine: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  optimizedMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10 },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 999 },
  applyBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingTop: 8, borderTopWidth: 1 },
  inputField: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
