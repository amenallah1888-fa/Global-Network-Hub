import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type CircleDetail = {
  id: string;
  name: string;
  about: string;
  category: string;
  color: string;
  coverUrl?: string | null;
  paid: boolean;
  inviteOnly: boolean;
  price: number;
  rules?: string | null;
  membersCount: number;
  activeNow: number;
  founderIds: string[];
  poolBalance: number;
  joined: boolean;
  isAdmin: boolean;
  role?: string | null;
};

type Member = {
  circleId: string;
  userId: string;
  role: string;
  paid: boolean;
  createdAt: string;
  user: { id: string; name: string; avatarKey: string | null; handle: string } | null;
};

type JoinRequest = {
  circleId: string;
  userId: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; avatarKey: string | null; handle: string } | null;
};

type ChatMessage = {
  id: string;
  circleId: string;
  userId: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; avatarKey: string | null; handle: string } | null;
};

type Announcement = { id: string; circleId: string; authorId: string; content: string; pinned: boolean; createdAt: string };
type CircleEvent = { id: string; circleId: string; title: string; description: string; scheduledAt: string; createdAt: string };

const TABS = ["Chat", "Members", "Announcements", "Settings"] as const;
type Tab = typeof TABS[number];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CircleDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Chat");
  const chatListRef = useRef<FlatList>(null);

  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [postingAnn, setPostingAnn] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [postingEvent, setPostingEvent] = useState(false);
  const [editAbout, setEditAbout] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: circle, isLoading: circleLoading } = useQuery<CircleDetail>({
    queryKey: [`/api/circles/${id}`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/circles/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!id && !!token,
    staleTime: 15_000,
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: [`/api/circles/${id}/members`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/circles/${id}/members`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id && !!token && activeTab === "Members",
  });

  const { data: requests } = useQuery<JoinRequest[]>({
    queryKey: [`/api/circles/${id}/requests`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/circles/${id}/requests`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id && !!token && activeTab === "Members" && !!circle?.isAdmin,
  });

  const { data: chatMessages } = useQuery<ChatMessage[]>({
    queryKey: [`/api/circles/${id}/chat`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/circles/${id}/chat`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id && !!token && activeTab === "Chat",
    refetchInterval: activeTab === "Chat" ? 8000 : false,
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: [`/api/circles/${id}/announcements`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/circles/${id}/announcements`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id && !!token && activeTab === "Announcements",
  });

  const { data: events } = useQuery<CircleEvent[]>({
    queryKey: [`/api/circles/${id}/events`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/circles/${id}/events`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id && !!token && activeTab === "Announcements",
  });

  useEffect(() => {
    if (circle && activeTab === "Settings") {
      setEditAbout(circle.about);
      setEditRules(circle.rules ?? "");
      setEditPrice(String(circle.price));
    }
  }, [circle, activeTab]);

  const sendChat = async () => {
    if (!chatText.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      await fetch(`${API_BASE}/api/circles/${id}/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: chatText.trim() }),
      });
      setChatText("");
      qc.invalidateQueries({ queryKey: [`/api/circles/${id}/chat`] });
    } finally {
      setSendingChat(false);
    }
  };

  const postAnnouncement = async () => {
    if (!newAnnouncement.trim() || postingAnn) return;
    setPostingAnn(true);
    try {
      await fetch(`${API_BASE}/api/circles/${id}/announcements`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: newAnnouncement.trim() }),
      });
      setNewAnnouncement("");
      qc.invalidateQueries({ queryKey: [`/api/circles/${id}/announcements`] });
    } finally {
      setPostingAnn(false);
    }
  };

  const postEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate.trim() || postingEvent) return;
    setPostingEvent(true);
    try {
      const scheduledAt = new Date(newEventDate).toISOString();
      await fetch(`${API_BASE}/api/circles/${id}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: newEventTitle.trim(), description: newEventDesc.trim(), scheduledAt }),
      });
      setNewEventTitle(""); setNewEventDate(""); setNewEventDesc("");
      qc.invalidateQueries({ queryKey: [`/api/circles/${id}/events`] });
    } catch {
      Alert.alert("Error", "Invalid date format. Use YYYY-MM-DD HH:MM");
    } finally {
      setPostingEvent(false);
    }
  };

  const approveRequest = async (userId: string) => {
    await fetch(`${API_BASE}/api/circles/${id}/requests/${userId}/approve`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    qc.invalidateQueries({ queryKey: [`/api/circles/${id}/requests`] });
    qc.invalidateQueries({ queryKey: [`/api/circles/${id}/members`] });
    qc.invalidateQueries({ queryKey: [`/api/circles/${id}`] });
  };

  const rejectRequest = async (userId: string) => {
    await fetch(`${API_BASE}/api/circles/${id}/requests/${userId}/reject`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    qc.invalidateQueries({ queryKey: [`/api/circles/${id}/requests`] });
  };

  const kickMember = async (userId: string, name: string) => {
    Alert.alert("Remove Member", `Remove ${name} from this circle?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await fetch(`${API_BASE}/api/circles/${id}/members/${userId}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${token}` },
          });
          qc.invalidateQueries({ queryKey: [`/api/circles/${id}/members`] });
          qc.invalidateQueries({ queryKey: [`/api/circles/${id}`] });
        },
      },
    ]);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch(`${API_BASE}/api/circles/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ about: editAbout, rules: editRules, price: parseInt(editPrice, 10) || 0 }),
      });
      qc.invalidateQueries({ queryKey: [`/api/circles/${id}`] });
      Alert.alert("Saved", "Circle settings updated.");
    } finally {
      setSavingSettings(false);
    }
  };

  if (circleLoading || !circle) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { backgroundColor: colors.cardElevated }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.foreground }]}>Circle</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { backgroundColor: colors.cardElevated }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>{circle.name}</Text>
          <View style={styles.topBarMeta}>
            <View style={[styles.catDot, { backgroundColor: circle.color }]} />
            <Text style={[styles.topBarSub, { color: colors.mutedForeground }]}>{circle.category} · {circle.membersCount} members</Text>
            {circle.isAdmin && (
              <View style={[styles.adminBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Admin</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, { borderBottomColor: active ? colors.primary : "transparent" }]}
              >
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>{tab}</Text>
                {tab === "Members" && (requests?.length ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
                    <Text style={styles.badgeText}>{requests?.length}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {activeTab === "Chat" && (
        <View style={{ flex: 1 }}>
          {circle.paid && (
            <View style={[styles.poolBanner, { backgroundColor: colors.tip + "15", borderColor: colors.tip }]}>
              <Feather name="layers" size={13} color={colors.tip} />
              <Text style={[styles.poolText, { color: colors.tip }]}>
                Circle Pool: {circle.poolBalance} π collected
              </Text>
            </View>
          )}
          <FlatList
            ref={chatListRef}
            data={chatMessages ?? []}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyCenter}>
                <Feather name="message-circle" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No messages yet. Start the conversation!</Text>
              </View>
            }
            renderItem={({ item: msg }) => (
              <View style={styles.chatRow}>
                <Avatar avatarKey={msg.user?.avatarKey ?? null} size={34} />
                <View style={[styles.chatBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.chatBubbleHeader}>
                    <Text style={[styles.chatSender, { color: colors.foreground }]}>{msg.user?.name ?? "Unknown"}</Text>
                    <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>{timeAgo(msg.createdAt)}</Text>
                  </View>
                  <Text style={[styles.chatText, { color: colors.foreground }]}>{msg.text}</Text>
                </View>
              </View>
            )}
          />
          <View style={[styles.chatInput, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              value={chatText}
              onChangeText={setChatText}
              placeholder="Message the circle…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.chatInputField, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
              onSubmitEditing={sendChat}
              returnKeyType="send"
            />
            <Pressable
              onPress={sendChat}
              disabled={sendingChat || !chatText.trim()}
              style={({ pressed }) => [styles.sendBtn, { backgroundColor: colors.primary, opacity: pressed || !chatText.trim() ? 0.5 : 1 }]}
            >
              {sendingChat ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
        </View>
      )}

      {activeTab === "Members" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {(requests?.length ?? 0) > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="clock" size={15} color="#F97316" />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pending Requests ({requests!.length})</Text>
              </View>
              {requests!.map((req) => (
                <View key={req.userId} style={[styles.memberRow, { borderTopColor: colors.border }]}>
                  <Avatar avatarKey={req.user?.avatarKey ?? null} size={38} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{req.user?.name ?? req.userId}</Text>
                    <Text style={[styles.memberHandle, { color: colors.mutedForeground }]}>@{req.user?.handle ?? "—"}</Text>
                  </View>
                  <View style={styles.reqActions}>
                    <Pressable onPress={() => approveRequest(req.userId)} style={({ pressed }) => [styles.approveBtn, { backgroundColor: "#22C55E", opacity: pressed ? 0.8 : 1 }]}>
                      <Feather name="check" size={14} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => rejectRequest(req.userId)} style={({ pressed }) => [styles.rejectBtn, { backgroundColor: "#EF4444", opacity: pressed ? 0.8 : 1 }]}>
                      <Feather name="x" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
            <View style={styles.sectionHeader}>
              <Feather name="users" size={15} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members ({members?.length ?? 0})</Text>
            </View>
            {(members ?? []).length === 0 && (
              <View style={styles.emptyCenter}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No members yet</Text>
              </View>
            )}
            {(members ?? []).map((m) => (
              <View key={m.userId} style={[styles.memberRow, { borderTopColor: colors.border }]}>
                <Avatar avatarKey={m.user?.avatarKey ?? null} size={38} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{m.user?.name ?? m.userId}</Text>
                    {m.role === "admin" && (
                      <View style={[styles.rolePill, { backgroundColor: colors.primary + "20" }]}>
                        <Text style={[styles.rolePillText, { color: colors.primary }]}>Admin</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.memberHandle, { color: colors.mutedForeground }]}>@{m.user?.handle ?? "—"}</Text>
                </View>
                {circle.isAdmin && m.role !== "admin" && (
                  <Pressable onPress={() => kickMember(m.userId, m.user?.name ?? m.userId)} style={({ pressed }) => [styles.kickBtn, { backgroundColor: "#EF444418", borderColor: "#EF4444", opacity: pressed ? 0.7 : 1 }]}>
                    <Feather name="user-x" size={13} color="#EF4444" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {activeTab === "Announcements" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {circle.isAdmin && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="bell" size={15} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Post Announcement</Text>
              </View>
              <TextInput
                value={newAnnouncement}
                onChangeText={setNewAnnouncement}
                placeholder="Write a pinned update for your members…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[styles.annoInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]}
              />
              <Pressable onPress={postAnnouncement} disabled={postingAnn || !newAnnouncement.trim()} style={({ pressed }) => [styles.postBtn, { backgroundColor: colors.primary, opacity: pressed || !newAnnouncement.trim() ? 0.5 : 1 }]}>
                {postingAnn ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Post Update</Text>}
              </Pressable>
            </View>
          )}

          {(announcements ?? []).length === 0 && !circle.isAdmin && (
            <View style={styles.emptyCenter}>
              <Feather name="bell" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No announcements yet</Text>
            </View>
          )}
          {(announcements ?? []).map((a) => (
            <View key={a.id} style={[styles.annoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.annoHeader}>
                <View style={[styles.annoPinIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="pin" size={12} color={colors.primary} />
                </View>
                <Text style={[styles.annoMeta, { color: colors.mutedForeground }]}>{formatDate(a.createdAt)}</Text>
              </View>
              <Text style={[styles.annoContent, { color: colors.foreground }]}>{a.content}</Text>
            </View>
          ))}

          {circle.isAdmin && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
              <View style={styles.sectionHeader}>
                <Feather name="calendar" size={15} color="#22C55E" />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Schedule Meeting</Text>
              </View>
              <TextInput value={newEventTitle} onChangeText={setNewEventTitle} placeholder="Event title" placeholderTextColor={colors.mutedForeground}
                style={[styles.settingInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
              <TextInput value={newEventDate} onChangeText={setNewEventDate} placeholder="Date: YYYY-MM-DD HH:MM" placeholderTextColor={colors.mutedForeground}
                style={[styles.settingInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
              <TextInput value={newEventDesc} onChangeText={setNewEventDesc} placeholder="Description (optional)" placeholderTextColor={colors.mutedForeground} multiline
                style={[styles.settingInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
              <Pressable onPress={postEvent} disabled={postingEvent} style={({ pressed }) => [styles.postBtn, { backgroundColor: "#22C55E", opacity: pressed ? 0.7 : 1 }]}>
                {postingEvent ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Schedule</Text>}
              </Pressable>
            </View>
          )}

          {(events ?? []).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Upcoming Events</Text>
              {(events ?? []).map((evt) => (
                <View key={evt.id} style={[styles.eventCard, { backgroundColor: colors.card, borderColor: "#22C55E" }]}>
                  <View style={[styles.eventIcon, { backgroundColor: "#22C55E20" }]}>
                    <Feather name="calendar" size={16} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventTitle, { color: colors.foreground }]}>{evt.title}</Text>
                    <Text style={[styles.eventDate, { color: "#22C55E" }]}>{formatDate(evt.scheduledAt)}</Text>
                    {evt.description ? <Text style={[styles.eventDesc, { color: colors.mutedForeground }]}>{evt.description}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {activeTab === "Settings" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {!circle.isAdmin ? (
            <View style={styles.emptyCenter}>
              <Feather name="lock" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Only the circle admin can edit settings</Text>
            </View>
          ) : (
            <>
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Feather name="settings" size={15} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Circle Settings</Text>
                </View>

                <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>Description</Text>
                <TextInput value={editAbout} onChangeText={setEditAbout} multiline
                  style={[styles.settingInput, styles.settingTextarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />

                <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>Circle Rules</Text>
                <TextInput value={editRules} onChangeText={setEditRules} multiline placeholder="Set expectations…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.settingInput, styles.settingTextarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />

                {circle.paid && (
                  <>
                    <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>Entry Fee (Pi)</Text>
                    <TextInput value={editPrice} onChangeText={setEditPrice} keyboardType="numeric"
                      style={[styles.settingInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }]} />
                  </>
                )}

                <Pressable onPress={saveSettings} disabled={savingSettings} style={({ pressed }) => [styles.postBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1, marginTop: 8 }]}>
                  {savingSettings ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Save Changes</Text>}
                </Pressable>
              </View>

              {circle.paid && (
                <View style={[styles.poolCard, { backgroundColor: colors.tip + "15", borderColor: colors.tip }]}>
                  <Feather name="layers" size={22} color={colors.tip} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.poolLabel, { color: colors.tip }]}>Shared Pool Balance</Text>
                    <Text style={[styles.poolAmount, { color: colors.tip }]}>{circle.poolBalance} π</Text>
                    <Text style={[styles.poolSub, { color: colors.mutedForeground }]}>Total collected from entry fees</Text>
                  </View>
                </View>
              )}

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoKey, { color: colors.mutedForeground }]}>Type</Text>
                  <Text style={[styles.infoVal, { color: colors.foreground }]}>{circle.paid ? "Paid" : circle.inviteOnly ? "Invite-only" : "Open"}</Text>
                </View>
                <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[styles.infoKey, { color: colors.mutedForeground }]}>Category</Text>
                  <Text style={[styles.infoVal, { color: colors.foreground }]}>{circle.category}</Text>
                </View>
                <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[styles.infoKey, { color: colors.mutedForeground }]}>Members</Text>
                  <Text style={[styles.infoVal, { color: colors.foreground }]}>{circle.membersCount}</Text>
                </View>
                {circle.rules ? (
                  <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.infoKey, { color: colors.mutedForeground }]}>Rules</Text>
                    <Text style={[styles.infoVal, { color: colors.foreground, flex: 2 }]}>{circle.rules}</Text>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  topBarMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  topBarSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  adminBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  adminBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  tabBar: { borderBottomWidth: 1 },
  tabBarInner: { flexDirection: "row", paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, flexDirection: "row", alignItems: "center", gap: 5 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  poolBanner: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, marginBottom: 0, padding: 10, borderRadius: 10, borderWidth: 1 },
  poolText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chatRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "flex-start" },
  chatBubble: { flex: 1, padding: 10, borderRadius: 14, borderWidth: 1 },
  chatBubbleHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  chatSender: { fontSize: 13, fontFamily: "Inter_700Bold" },
  chatTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chatText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  chatInput: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingTop: 8, borderTopWidth: 1 },
  chatInputField: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  section: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, paddingBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1 },
  memberName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  memberHandle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  rolePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  rolePillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  reqActions: { flexDirection: "row", gap: 8 },
  approveBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rejectBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  kickBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  annoInput: { borderWidth: 1, borderRadius: 12, margin: 12, marginTop: 4, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 72, textAlignVertical: "top" },
  annoCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  annoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  annoPinIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  annoMeta: { fontSize: 11, fontFamily: "Inter_500Medium" },
  annoContent: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  postBtn: { marginHorizontal: 12, marginBottom: 12, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  postBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  eventCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  eventIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  eventTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  eventDate: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  eventDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  settingLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginHorizontal: 12, marginTop: 10, marginBottom: 4 },
  settingInput: { borderWidth: 1, borderRadius: 10, marginHorizontal: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  settingTextarea: { minHeight: 72, textAlignVertical: "top" },
  emptyCenter: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", paddingHorizontal: 32 },
  poolCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 14 },
  poolLabel: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  poolAmount: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  poolSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoCard: { borderRadius: 16, borderWidth: 1, marginTop: 14, overflow: "hidden" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  infoKey: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoVal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
