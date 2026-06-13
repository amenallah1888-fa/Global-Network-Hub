import { Feather } from "@expo/vector-icons";
import {
  getListUsersQueryKey,
  useListCircles,
  useListPosts,
  useListUsers,
  useToggleFollow,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useAvatarData } from "@/lib/useAvatarData";
import { useCurrentUser, useCurrentUserId } from "@/lib/userCache";
import { AvatarProgressionHub } from "@/components/AvatarProgressionHub";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, clearSession } = useAuth();
  const me = useCurrentUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"profile" | "account">("profile");
  const [name, setName] = useState(me.name ?? "");
  const [bio, setBio] = useState(me.bio ?? "");
  const [city, setCity] = useState(me.city ?? "");
  const [country, setCountry] = useState(me.country ?? "");
  const [title, setTitle] = useState(me.title ?? "");
  const [company, setCompany] = useState(me.company ?? "");
  const [avatarKey, setAvatarKey] = useState(me.avatarKey ?? "");
  const [linkedin, setLinkedin] = useState((me as any).linkedin ?? "");
  const [twitter, setTwitter] = useState((me as any).twitter ?? "");
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, city, country, title, company, avatarKey, linkedin, twitter }),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["/api/me"] });
        qc.invalidateQueries({ queryKey: ["/api/users"] });
        Alert.alert("Saved", "Your profile has been updated.");
        onClose();
      } else {
        Alert.alert("Error", "Could not save profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          onClose();
          router.replace("/login");
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[sm.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        <View style={[sm.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10} style={[sm.closeBtn, { backgroundColor: colors.cardElevated }]}>
            <Feather name="x" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={[sm.headerTitle, { color: colors.foreground }]}>Settings</Text>
          {tab === "profile" ? (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [sm.saveBtn, { backgroundColor: colors.primary, opacity: pressed || saving ? 0.7 : 1 }]}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={sm.saveBtnText}>Save</Text>}
            </Pressable>
          ) : <View style={{ width: 60 }} />}
        </View>

        <View style={[sm.tabRow, { borderBottomColor: colors.border }]}>
          {(["profile", "account"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[sm.tabBtn, { borderBottomColor: tab === t ? colors.primary : "transparent" }]}>
              <Text style={[sm.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
                {t === "profile" ? "Edit Profile" : "Account"}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === "profile" && (
            <>
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Identity</Text>
                <Field label="Display Name" value={name} onChange={setName} placeholder="Your full name" colors={colors} />
                <Field label="Bio" value={bio} onChange={setBio} placeholder="Write a short bio…" multiline colors={colors} />
                <Field label="Avatar URL" value={avatarKey} onChange={setAvatarKey} placeholder="https://…" colors={colors} />
              </View>

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Location</Text>
                <Field label="City" value={city} onChange={setCity} placeholder="e.g. Tunis" colors={colors} />
                <Field label="Country" value={country} onChange={setCountry} placeholder="e.g. Tunisia" colors={colors} />
              </View>

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Professional</Text>
                <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Founder & CEO" colors={colors} />
                <Field label="Company" value={company} onChange={setCompany} placeholder="e.g. Acme Inc." colors={colors} />
              </View>

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Social Links</Text>
                <Field label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/in/…" colors={colors} />
                <Field label="Twitter / X" value={twitter} onChange={setTwitter} placeholder="@handle" colors={colors} />
              </View>
            </>
          )}

          {tab === "account" && (
            <>
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Identity & Role</Text>
                <View style={[sm.roleRow, { borderTopColor: colors.border }]}>
                  <View style={[sm.roleBadge, { backgroundColor: me.role === "validator" ? colors.primary + "20" : me.role === "admin" ? "#EF4444" + "20" : colors.cardElevated, borderColor: me.role === "validator" ? colors.primary : me.role === "admin" ? "#EF4444" : colors.border }]}>
                    <Feather name={me.role === "admin" ? "shield" : me.role === "validator" ? "check-circle" : "user"} size={13} color={me.role === "admin" ? "#EF4444" : me.role === "validator" ? colors.primary : colors.mutedForeground} />
                    <Text style={[sm.roleText, { color: me.role === "admin" ? "#EF4444" : me.role === "validator" ? colors.primary : colors.mutedForeground }]}>
                      {me.role === "admin" ? "Admin" : me.role === "validator" ? "Validator" : "Member"}
                    </Text>
                  </View>
                  {me.verified && (
                    <View style={[sm.roleBadge, { backgroundColor: "#22C55E20", borderColor: "#22C55E50" }]}>
                      <Feather name="check-circle" size={13} color="#22C55E" />
                      <Text style={[sm.roleText, { color: "#22C55E" }]}>Verified</Text>
                    </View>
                  )}
                  <View style={[sm.roleBadge, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
                    <Feather name="award" size={13} color={colors.mutedForeground} />
                    <Text style={[sm.roleText, { color: colors.mutedForeground }]}>KYC Pending</Text>
                  </View>
                </View>
              </View>

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Pi Wallet</Text>
                <View style={[sm.walletCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
                  <View style={[sm.walletIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[sm.walletIconText, { color: colors.primary }]}>π</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sm.walletLabel, { color: colors.primary }]}>Pi Network Wallet</Text>
                    <Text style={[sm.walletSub, { color: colors.mutedForeground }]}>Wallet linking via Pi SDK coming soon</Text>
                  </View>
                  <Feather name="external-link" size={16} color={colors.primary} />
                </View>
              </View>

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Notifications</Text>
                <Pressable
                  onPress={() => setNotifications((v) => !v)}
                  style={[sm.toggleRow, { borderTopColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[sm.toggleLabel, { color: colors.foreground }]}>Push notifications</Text>
                    <Text style={[sm.toggleSub, { color: colors.mutedForeground }]}>Likes, comments, offers</Text>
                  </View>
                  <View style={[sm.toggle, { backgroundColor: notifications ? colors.primary : colors.cardElevated }]}>
                    <View style={[sm.toggleThumb, { transform: [{ translateX: notifications ? 20 : 2 }] }]} />
                  </View>
                </Pressable>
              </View>

              <MyAssetsSection colors={colors} />

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Community</Text>
                <Pressable
                  onPress={() => { onClose(); router.push("/admin"); }}
                  style={[sm.toggleRow, { borderTopColor: colors.border }]}
                >
                  <View style={[sm.walletIcon, { backgroundColor: "#22C55E18", marginRight: 12 }]}>
                    <Feather name="shield" size={16} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sm.toggleLabel, { color: colors.foreground }]}>Validator Portal</Text>
                    <Text style={[sm.toggleSub, { color: colors.mutedForeground }]}>Review projects, docs & earn reputation</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {(me.role === "validator" || me.role === "admin") && (
                      <View style={{ backgroundColor: "#22C55E18", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#22C55E" }}>ACTIVE</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              </View>

              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Account</Text>
                <Pressable onPress={signOut} style={[sm.dangerRow, { borderTopColor: colors.border }]}>
                  <Feather name="log-out" size={16} color="#EF4444" />
                  <Text style={sm.dangerText}>Sign out</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, multiline, colors }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[sm.field, { borderTopColor: colors.border }]}>
      <Text style={[sm.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        style={[sm.fieldInput, {
          color: colors.foreground,
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? "top" : undefined,
          ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
        }]}
      />
    </View>
  );
}

function MyAssetsSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { token } = useAuth();
  const currentUserId = useCurrentUserId();
  const { data: pitches, isLoading } = useQuery<any[]>({
    queryKey: ["/api/pitches", "mine"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pitches?mine=true`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((p: any) => p.founderId === currentUserId);
    },
    enabled: !!token,
    staleTime: 30_000,
  });
  const assets = pitches ?? [];
  if (isLoading) return null;
  if (assets.length === 0) return (
    <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[sm.sectionTitle, { color: colors.foreground }]}>My Platform Assets</Text>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          No pitches, apps or services listed yet.
        </Text>
      </View>
    </View>
  );
  return (
    <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[sm.sectionTitle, { color: colors.foreground }]}>My Platform Assets</Text>
      {assets.map((a: any, i: number) => {
        const trust = a.trustScore ?? 0;
        const col = trust >= 70 ? "#22C55E" : trust >= 40 ? "#F59E0B" : colors.mutedForeground;
        return (
          <View key={a.id} style={[sm.assetRow, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 1 : 0 }]}>
            <View style={[sm.assetIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name={(a.entityType === "app" ? "cpu" : a.entityType === "service_app" ? "grid" : "zap") as any} size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>{a.title}</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{a.stage} · {a.industry}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: col }}>{trust}%</Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Trust</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WalletModal({ visible, onClose, monthlySpend }: { visible: boolean; onClose: () => void; monthlySpend: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={wm.backdrop}>
        <Pressable style={wm.overlay} onPress={onClose} />
        <View style={[wm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={wm.handle} />
          <View style={[wm.orbRow]}>
            <View style={[wm.orb, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[wm.orbText, { color: colors.primary }]}>π</Text>
            </View>
          </View>
          <Text style={[wm.title, { color: colors.foreground }]}>Pi Wallet</Text>
          <Text style={[wm.sub, { color: colors.mutedForeground }]}>Your HumanVerse financial hub</Text>
          <View style={[wm.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={wm.statRow}>
              <Text style={[wm.statKey, { color: colors.mutedForeground }]}>Monthly circle spend</Text>
              <Text style={[wm.statVal, { color: colors.foreground }]}>{monthlySpend} π</Text>
            </View>
            <View style={[wm.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[wm.statKey, { color: colors.mutedForeground }]}>Connected wallet</Text>
              <Text style={[wm.statVal, { color: colors.mutedForeground }]}>Not linked</Text>
            </View>
          </View>
          <View style={[wm.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
            <Feather name="info" size={13} color={colors.primary} />
            <Text style={[wm.infoText, { color: colors.primary }]}>
              Full Pi Network wallet integration coming. Your transaction history is already tracked in-app.
            </Text>
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [wm.closeBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={wm.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const me = useCurrentUser();
  const currentUserId = useCurrentUserId();
  const { data: users } = useListUsers();
  const { data: posts } = useListPosts();
  const { data: circles } = useListCircles();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [avatarHubOpen, setAvatarHubOpen] = useState(false);

  const allPosts = posts ?? [];
  const allCircles = circles ?? [];
  const allUsers = users ?? [];

  const myPosts = allPosts.filter((p) => p.authorId === currentUserId).length;
  const totalTips = allPosts.reduce((s, p) => s + (p.authorId === currentUserId ? p.tipsTotal : 0), 0);
  const followingCount = allUsers.filter((u) => u.following).length;
  const joinedCircles = allCircles.filter((c) => c.joined).length;
  const monthlySpend = allCircles.filter((c) => c.joined && c.paid).reduce((s, c) => s + c.price, 0);

  const { data: avatarData } = useAvatarData(currentUserId);

  const myPitch = allPosts.length > 0 ? null : null;
  const myPitchId = null;

  const suggested = allUsers.filter((u) => u.id !== currentUserId && !u.following);

  const onShare = async () => {
    const profileUrl = `https://humanverse.app/@${me.handle}`;
    try {
      if (Platform.OS === "web") {
        await Clipboard.setString(profileUrl);
        Alert.alert("Copied!", "Profile link copied to clipboard.");
      } else {
        await Share.share({
          message: `Check out @${me.handle} on HumanVerse — ${me.bio || "the social business super app"}\n${profileUrl}`,
          title: me.name,
          url: profileUrl,
        });
      }
    } catch { /* dismissed */ }
  };

  const onCompose = () => {
    router.push("/(tabs)");
  };

  const onMyPitch = () => {
    router.push("/(tabs)/pitches");
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.cover, { backgroundColor: colors.card, paddingTop: topPad + 24, borderColor: colors.border }]}>
        <View style={styles.coverTop}>
          <Pressable onPress={() => setAvatarHubOpen(true)}>
            <Avatar
              avatarKey={me.avatarKey}
              size={84}
              ring
              level={avatarData?.level}
              skinTier={avatarData?.activeSkin?.tier}
            />
          </Pressable>
          <View style={styles.coverActions}>
            <Pressable
              onPress={onShare}
              style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="share-2" size={16} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="settings" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>{me.name}</Text>
            {me.verified ? <Feather name="check-circle" size={16} color={colors.primary} style={{ marginLeft: 6 }} /> : null}
            {(avatarData?.dailyStreak ?? 0) > 1 && (
              <View style={[styles.streakBadge, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B50" }]}>
                <Text style={{ fontSize: 12 }}>🔥</Text>
                <Text style={[styles.streakNum, { color: "#F59E0B" }]}>{avatarData!.dailyStreak}</Text>
              </View>
            )}
            {((me as any).reputationScore ?? 0) > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: "#8B5CF620", borderColor: "#8B5CF650" }]}>
                <Text style={{ fontSize: 11 }}>⭐</Text>
                <Text style={[styles.streakNum, { color: "#8B5CF6" }]}>{(me as any).reputationScore}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>@{me.handle}</Text>
          <Text style={[styles.bio, { color: colors.foreground }]}>
            {me.bio}{"\n"}
            <Text style={{ color: colors.mutedForeground }}>{me.city}, {me.country}</Text>
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Followers" value={me.followersCount.toLocaleString()} />
          <Divider />
          <Stat label="Following" value={followingCount.toString()} />
          <Divider />
          <Stat label="Circles" value={joinedCircles.toString()} />
          <Divider />
          <Stat label="Tips earned" value={totalTips + " π"} accent={colors.tip} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick actions</Text>
        <View style={styles.actionGrid}>
          <ActionTile
            icon="edit-3"
            label="Compose"
            color={colors.primary}
            onPress={onCompose}
          />
          <ActionTile
            icon="layers"
            label={monthlySpend > 0 ? `${monthlySpend} π/mo` : "Pi Wallet"}
            color={colors.tip}
            sub={monthlySpend > 0 ? "Spend" : undefined}
            onPress={() => setWalletOpen(true)}
          />
          <ActionTile
            icon="trending-up"
            label="My Campaigns"
            color={colors.accent}
            onPress={() => router.push("/my-campaigns")}
          />
          <ActionTile
            icon="mail"
            label="Messages"
            color={colors.sponsor}
            onPress={() => router.push("/inbox")}
          />
          <ActionTile
            icon="briefcase"
            label="My pitch"
            color={colors.primary}
            onPress={onMyPitch}
          />
          <ActionTile
            icon="shield"
            label="Validator"
            color="#8B5CF6"
            onPress={() => router.push("/admin")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Suggested to follow</Text>
          <Pressable onPress={() => Alert.alert("Discover people", "Full discover page coming soon.")}>
            <Text style={[styles.sectionAction, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>
        {suggested.slice(0, 5).map((u) => (
          <SuggestedRow key={u.id} userId={u.id} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Activity</Text>
        <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityRow icon="edit-3" color={colors.accent} label={`${myPosts} post${myPosts === 1 ? "" : "s"} this week`} meta="+24% engagement" />
          <ActivityRow icon="repeat" color={colors.success} label="142 reposts on your work" meta="Across 3 timezones" />
          <ActivityRow icon="map-pin" color={colors.primary} label="11 connections within 20km" meta={me.city} last />
        </View>
      </View>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WalletModal visible={walletOpen} onClose={() => setWalletOpen(false)} monthlySpend={monthlySpend} />
      <AvatarProgressionHub
        visible={avatarHubOpen}
        onClose={() => setAvatarHubOpen(false)}
        userId={currentUserId ?? ""}
        avatarKey={me.avatarKey}
      />
    </ScrollView>
  );
}

function SuggestedRow({ userId }: { userId: string }) {
  const colors = useColors();
  const { data: users } = useListUsers();
  const u = (users ?? []).find((x) => x.id === userId);
  const queryClient = useQueryClient();
  const follow = useToggleFollow();
  if (!u) return null;
  return (
    <Pressable
      onPress={() => router.push(`/profile/${u.id}`)}
      style={({ pressed }) => [styles.userRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.95 : 1 }]}
    >
      <Avatar avatarKey={u.avatarKey} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
        <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{u.title} · {u.city}</Text>
      </View>
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); router.push(`/chat/${u.id}`); }}
        hitSlop={6}
        style={({ pressed }) => [styles.contactIcon, { backgroundColor: colors.cardElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name="message-circle" size={14} color={colors.foreground} />
      </Pressable>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          follow.mutate({ id: u.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }) });
        }}
        style={({ pressed }) => [styles.followBtn, { backgroundColor: u.following ? colors.cardElevated : colors.foreground, borderColor: u.following ? colors.border : colors.foreground, borderWidth: 1, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.followText, { color: u.following ? colors.foreground : colors.background }]}>
          {u.following ? "Following" : "Follow"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const colors = useColors();
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statValue, { color: accent ?? colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function ActionTile({ icon, label, color, sub, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; color: string; sub?: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionTile, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.actionIcon, { backgroundColor: color + "1F" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
      {sub ? <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
    </Pressable>
  );
}

function ActivityRow({ icon, color, label, meta, last }: { icon: keyof typeof Feather.glyphMap; color: string; label: string; meta: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.activityRow, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={[styles.activityIcon, { backgroundColor: color + "1F" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.activityLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.activityMeta, { color: colors.mutedForeground }]}>{meta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  coverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coverActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  nameBlock: { marginTop: 16 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1, marginLeft: 6 },
  streakNum: { fontSize: 11, fontFamily: "Inter_700Bold" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  handle: { marginTop: 2, fontSize: 13, fontFamily: "Inter_500Medium" },
  bio: { marginTop: 10, fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 18, paddingTop: 14 },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  divider: { width: 1, height: 28 },
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2, marginBottom: 12 },
  sectionAction: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionGrid: { flexDirection: "row", gap: 10 },
  actionTile: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 6 },
  actionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  actionSub: { fontSize: 10, fontFamily: "Inter_500Medium" },
  userRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  contactIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 8 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  followText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  activityCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  activityIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  activityLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activityMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
});

const sm = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.3, textTransform: "uppercase", paddingHorizontal: 16, paddingVertical: 12 },
  field: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, marginBottom: 4 },
  fieldInput: { fontSize: 15, fontFamily: "Inter_400Regular" },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  roleText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  walletCard: { flexDirection: "row", alignItems: "center", gap: 12, margin: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  walletIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  walletIconText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  walletLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  walletSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toggleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", elevation: 2 },
  dangerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  dangerText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  assetIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});

const wm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 100 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, padding: 24, paddingTop: 16, gap: 14 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 8 },
  orbRow: { alignItems: "center" },
  orb: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  orbText: { fontSize: 32, fontFamily: "Inter_700Bold" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.4 },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -8 },
  statCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  statRow: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  statKey: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  infoText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 18 },
  closeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  closeBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
