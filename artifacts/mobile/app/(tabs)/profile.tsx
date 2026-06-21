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
  Appearance,
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
  const [biometrics, setBiometrics] = useState(false);
  const [profileVisible, setProfileVisible] = useState(true);
  const [pitchAlerts, setPitchAlerts] = useState(true);
  const [milestoneNotifs, setMilestoneNotifs] = useState(true);
  const [validatorVoting, setValidatorVoting] = useState(false);
  const [validatorLockVisible, setValidatorLockVisible] = useState(false);
  const [kycBypassing, setKycBypassing] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletAddress, setWalletAddress] = useState((me as any).piWalletAddress ?? "");
  const [savingWallet, setSavingWallet] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">("system");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const handleKycBypass = async () => {
    setKycBypassing(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/promote-kyc`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      Alert.alert("KYC Verified ✓", "Your account is now KYC Verified. All features unlocked — you can publish pitches and access the Creator Flow.");
    } catch {
      Alert.alert("Error", "Could not update KYC status.");
    } finally {
      setKycBypassing(false);
    }
  };

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

  const handleSaveWallet = async () => {
    setSavingWallet(true);
    try {
      await fetch(`${API_BASE}/api/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ piWalletAddress: walletAddress.trim() }),
      });
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      setWalletModalVisible(false);
      Alert.alert("Saved", "Your Pi wallet address has been updated.");
    } catch { Alert.alert("Error", "Could not save wallet address."); }
    finally { setSavingWallet(false); }
  };

  const handleProfileVisibilityToggle = async (newVal: boolean) => {
    setProfileVisible(newVal);
    setSavingVisibility(true);
    try {
      await fetch(`${API_BASE}/api/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isProfilePublic: newVal }),
      });
      qc.invalidateQueries({ queryKey: ["/api/me"] });
    } catch { setProfileVisible(!newVal); Alert.alert("Error", "Could not update visibility."); }
    finally { setSavingVisibility(false); }
  };

  const handleClearCache = () => {
    qc.clear();
    Alert.alert("✓ Cache Cleared", "Temporary data and cached network responses have been flushed. The app will refresh fresh data on next load.");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This action is permanent and clears all your data, pitches, and transaction history from the network.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await fetch(`${API_BASE}/api/me`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
              await clearSession();
              onClose();
              router.replace("/login");
            } catch { Alert.alert("Error", "Could not delete account. Please try again."); }
            finally { setDeletingAccount(false); }
          },
        },
      ]
    );
  };

  const handleThemeChange = (mode: "system" | "light" | "dark") => {
    setThemeMode(mode);
    Appearance.setColorScheme(mode === "system" ? null : mode);
    setThemeModalVisible(false);
  };

  return (
    <>
    {/* Wallet address modal */}
    <Modal visible={walletModalVisible} transparent animationType="slide" onRequestClose={() => setWalletModalVisible(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <View style={{ backgroundColor: "#6366F120", borderRadius: 12, padding: 9 }}><Feather name="credit-card" size={20} color="#6366F1" /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Pi Wallet Address</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>Your public wallet key for receiving payouts</Text>
            </View>
            <Pressable onPress={() => setWalletModalVisible(false)} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
          </View>
          <TextInput
            value={walletAddress}
            onChangeText={setWalletAddress}
            placeholder="Paste your Pi wallet address here…"
            placeholderTextColor={colors.mutedForeground}
            style={{ backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 17 }}>
            Your wallet address is stored securely and used only for milestone payouts and escrow settlements. Never share your private key.
          </Text>
          <Pressable onPress={handleSaveWallet} disabled={savingWallet} style={({ pressed }) => ({ backgroundColor: "#6366F1", borderRadius: 14, paddingVertical: 14, alignItems: "center" as const, opacity: pressed || savingWallet ? 0.7 : 1 })}>
            {savingWallet ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" }}>Save Wallet Address</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>

    {/* Theme selector modal */}
    <Modal visible={themeModalVisible} transparent animationType="fade" onRequestClose={() => setThemeModalVisible(false)}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }} onPress={() => setThemeModalVisible(false)}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderRadius: 24, width: "100%", overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ backgroundColor: "#F59E0B20", borderRadius: 12, padding: 8 }}><Feather name="sun" size={20} color="#F59E0B" /></View>
            <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Appearance</Text>
          </View>
          {([
            { mode: "system" as const, label: "System Default", sub: "Matches your device's light/dark setting automatically", icon: "monitor" as const },
            { mode: "light" as const, label: "Light Mode", sub: "Always use the light colour palette", icon: "sun" as const },
            { mode: "dark" as const, label: "Dark Mode", sub: "Always use the dark colour palette", icon: "moon" as const },
          ] as const).map((opt) => (
            <Pressable key={opt.mode} onPress={() => handleThemeChange(opt.mode)} style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, padding: 18, gap: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: themeMode === opt.mode ? colors.primary + "10" : "transparent", opacity: pressed ? 0.7 : 1 })}>
              <Feather name={opt.icon} size={18} color={themeMode === opt.mode ? colors.primary : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: themeMode === opt.mode ? colors.primary : colors.foreground }}>{opt.label}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{opt.sub}</Text>
              </View>
              {themeMode === opt.mode && <Feather name="check-circle" size={18} color={colors.primary} />}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>

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
              {/* ── 1. Account & Identity ── */}
              <SectionLabel label="ACCOUNT & IDENTITY" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[sm.roleRow, { borderTopColor: colors.border }]}>
                  <View style={[sm.roleBadge, { backgroundColor: me.role === "validator" ? colors.primary + "20" : me.role === "admin" ? "#EF444420" : colors.cardElevated, borderColor: me.role === "validator" ? colors.primary : me.role === "admin" ? "#EF4444" : colors.border }]}>
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
                  <View style={[sm.roleBadge, { backgroundColor: (me as any).kycStatus === "verified" ? "#22C55E20" : colors.cardElevated, borderColor: (me as any).kycStatus === "verified" ? "#22C55E50" : colors.border }]}>
                    <Feather name={(me as any).kycStatus === "verified" ? "check-circle" : "shield"} size={13} color={(me as any).kycStatus === "verified" ? "#22C55E" : colors.mutedForeground} />
                    <Text style={[sm.roleText, { color: (me as any).kycStatus === "verified" ? "#22C55E" : colors.mutedForeground }]}>
                      {(me as any).kycStatus === "verified" ? "KYC Verified" : "KYC Pending"}
                    </Text>
                  </View>
                </View>
                <SettingsRow
                  icon={(me as any).kycStatus === "verified" ? "check-circle" : "shield"}
                  iconBg={(me as any).kycStatus === "verified" ? "#22C55E" : "#F59E0B"}
                  title="Identity Verification (KYC)"
                  sub={(me as any).kycStatus === "verified" ? "Identity confirmed. All high-tier features are unlocked." : "Verify your legal identity (Passport/ID) to unlock Validator status and high-tier investment limits."}
                  trailing={
                    <View style={[sm.roleBadge, { backgroundColor: (me as any).kycStatus === "verified" ? "#22C55E20" : "#F59E0B20", borderColor: (me as any).kycStatus === "verified" ? "#22C55E50" : "#F59E0B50" }]}>
                      <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: (me as any).kycStatus === "verified" ? "#22C55E" : "#F59E0B" }}>
                        {(me as any).kycStatus === "verified" ? "VERIFIED" : "PENDING"}
                      </Text>
                    </View>
                  }
                  onPress={(me as any).kycStatus !== "verified" ? () => Alert.alert("KYC Verification", "Submit your government-issued ID via the secure portal. Approval typically takes 24-48 hours.") : undefined}
                  colors={colors}
                />
                {(me.handle === "amen" || Platform.OS === "web") && (me as any).kycStatus !== "verified" && (
                  <Pressable
                    onPress={handleKycBypass}
                    disabled={kycBypassing}
                    style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, backgroundColor: "#8B5CF618", margin: 12, marginTop: 0, borderRadius: 10, paddingVertical: 11, borderWidth: 1, borderColor: "#8B5CF640", opacity: pressed || kycBypassing ? 0.7 : 1 })}
                  >
                    {kycBypassing ? <ActivityIndicator size="small" color="#8B5CF6" /> : <><Feather name="cpu" size={13} color="#8B5CF6" /><Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#8B5CF6" }}>Developer Bypass — Set KYC Verified</Text></>}
                  </Pressable>
                )}
                <SettingsRow
                  icon="edit"
                  iconBg={colors.primary}
                  title="Edit Profile"
                  sub="Update your display name, bio, profile picture, title, and location."
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={() => setTab("profile")}
                  colors={colors}
                />
              </View>

              {/* ── 2. Wallet & Economy ── */}
              <SectionLabel label="WALLET & ECONOMY" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SettingsRow
                  icon="credit-card"
                  iconBg="#6366F1"
                  title="Pi Wallet Configuration"
                  sub={(me as any).piWalletAddress ? `Linked: ${String((me as any).piWalletAddress).slice(0, 16)}…` : "Link your Pi wallet address for milestone payouts and escrow deposits."}
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={() => setWalletModalVisible(true)}
                  colors={colors}
                />
                <SettingsRow
                  icon={biometrics ? "lock" : "unlock"}
                  iconBg="#8B5CF6"
                  title="Transaction Passcode / Biometrics"
                  sub="Adds an extra layer of security before committing funds to Smart Escrow."
                  trailing={<Toggle active={biometrics} onToggle={() => setBiometrics((v) => !v)} colors={colors} />}
                  colors={colors}
                />
              </View>

              {/* ── 3. Privacy & Security ── */}
              <SectionLabel label="PRIVACY & SECURITY" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SettingsRow
                  icon="eye"
                  iconBg="#0EA5E9"
                  title="Profile Visibility"
                  sub={savingVisibility ? "Saving…" : "When disabled, only your name and level are visible to others."}
                  trailing={<Toggle active={profileVisible} onToggle={() => handleProfileVisibilityToggle(!profileVisible)} colors={colors} />}
                  colors={colors}
                />
                <SettingsRow
                  icon="monitor"
                  iconBg="#EF4444"
                  title="Active Sessions"
                  sub="View all devices where your account is signed in and revoke access remotely."
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={() => Alert.alert("Active Sessions", "You are currently signed in on 1 device.\n\nTo sign out from all devices, use Sign Out below.", [{ text: "Sign Out All", style: "destructive", onPress: signOut }, { text: "Cancel", style: "cancel" }])}
                  colors={colors}
                />
              </View>

              {/* ── 4. Notifications ── */}
              <SectionLabel label="NOTIFICATIONS" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SettingsRow
                  icon="zap"
                  iconBg="#F59E0B"
                  title="New Pitch Alerts"
                  sub="Receive a notification whenever a new project matching your investor profile is published."
                  trailing={<Toggle active={pitchAlerts} onToggle={() => setPitchAlerts((v) => !v)} colors={colors} />}
                  colors={colors}
                />
                <SettingsRow
                  icon="trending-up"
                  iconBg="#22C55E"
                  title="Milestone Updates"
                  sub="Stay updated in real-time when a project you backed delivers a milestone or requires a vote."
                  trailing={<Toggle active={milestoneNotifs} onToggle={() => setMilestoneNotifs((v) => !v)} colors={colors} />}
                  colors={colors}
                />
                <SettingsRow
                  icon="check-square"
                  iconBg="#8B5CF6"
                  title="Validator Voting Rounds"
                  sub="Get alerted when a new project block is ready for your validation and approval vote."
                  trailing={<Toggle active={validatorVoting} onToggle={() => setValidatorVoting((v) => !v)} colors={colors} />}
                  colors={colors}
                />
              </View>

              {/* ── 5. Gamification & Reputation ── */}
              <SectionLabel label="GAMIFICATION & REPUTATION" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Live reputation visual */}
                <View style={{ padding: 16, gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>Reputation Score</Text>
                        <View style={{ backgroundColor: colors.primary + "20", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: colors.primary + "40" }}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.primary }}>LVL {(me as any).level ?? 1}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}>
                          <View style={{ width: `${(me as any).reputationScore ?? 0}%` as any, height: "100%", borderRadius: 4, backgroundColor: ((me as any).reputationScore ?? 0) >= 85 ? "#22C55E" : ((me as any).reputationScore ?? 0) >= 50 ? "#F59E0B" : "#EF4444" }} />
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{(me as any).reputationScore ?? 0}/100</Text>
                      </View>
                    </View>
                  </View>
                  {/* XP explanation */}
                  <View style={{ backgroundColor: colors.cardElevated, borderRadius: 12, padding: 14, gap: 6 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.foreground }}>Reputation & XP Calculator</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 17 }}>
                      Your <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Level</Text> increases with XP (gained from app activity, completing profiles, and discussions). Your <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Reputation Score</Text> is your trust metric — it rises when you deliver milestones on time and falls during escrow refunds or violations. Reaching <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>Level 5 + 85% Reputation</Text> unlocks Validator status.
                    </Text>
                  </View>
                  {/* Smart Escrow guide */}
                  <View style={{ backgroundColor: colors.primary + "08", borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "25", padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="lock" size={13} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.primary }}>Smart Escrow & Milestones Guide</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 17 }}>
                      Funds committed to a project are safely locked in a decentralized Smart Escrow. They are automatically split into 3 milestones (<Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>30% ➡ 40% ➡ 30%</Text>) and are only released when the founder submits verifiable Proof of Work and backers approve it.
                    </Text>
                  </View>
                </View>
                {/* Validator Portal row */}
                {(() => {
                  const isValidator = me.role === "validator" || me.role === "admin";
                  const repScore = (me as any).reputationScore ?? 0;
                  const meetsRep = repScore >= 85;
                  const isLocked = !isValidator && !meetsRep;
                  return (
                    <>
                      <SettingsRow
                        icon={isLocked ? "lock" : "shield"}
                        iconBg={isLocked ? "#6B7280" : "#22C55E"}
                        title="Validator Portal"
                        sub={isLocked ? `Locked — ${repScore}/100 rep · need 85+ to unlock. Validators act as auditors reviewing project reality and boosting or lowering public Trust Scores. You cannot vote on your own projects.` : "Review projects, verify documents & earn reputation. You are strictly forbidden from voting on your own projects (conflict of interest)."}
                        trailing={
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {isValidator && <View style={{ backgroundColor: "#22C55E18", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#22C55E" }}>ACTIVE</Text></View>}
                            {isLocked && <View style={{ backgroundColor: "#6B728018", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#6B7280" }}>LOCKED</Text></View>}
                            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                          </View>
                        }
                        onPress={() => { if (isLocked) { setValidatorLockVisible(true); } else { onClose(); router.push("/admin"); } }}
                        colors={colors}
                      />
                      <Modal visible={validatorLockVisible} transparent animationType="fade" onRequestClose={() => setValidatorLockVisible(false)}>
                        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 }} onPress={() => setValidatorLockVisible(false)}>
                          <Pressable onPress={() => {}} style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, margin: 0, padding: 0, overflow: "hidden", width: "100%" }]}>
                            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
                              <View style={{ backgroundColor: "#F59E0B18", borderRadius: 12, padding: 8 }}><Feather name="lock" size={20} color="#F59E0B" /></View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Validator Portal</Text>
                                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: 2 }}>Unlock requirements</Text>
                              </View>
                              <Pressable onPress={() => setValidatorLockVisible(false)} hitSlop={10}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
                            </View>
                            <View style={{ padding: 20, gap: 14 }}>
                              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 20 }}>
                                Validators review pitches, verify documents, and protect the ecosystem from fraud. To become a Validator, meet all requirements below.
                              </Text>
                              {[
                                { label: "Reputation Score", current: repScore, required: 85, unit: "/ 100", icon: "star" as const, met: meetsRep },
                                { label: "Account Standing", current: "Active", required: "In good standing", unit: "", icon: "check-circle" as const, met: true },
                                { label: "Identity Verified", current: (me as any).kycStatus === "verified" ? "Verified" : "Pending", required: "KYC Verified", unit: "", icon: "user-check" as const, met: (me as any).kycStatus === "verified" },
                              ].map((req) => (
                                <View key={req.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: req.met ? "#22C55E40" : colors.border, backgroundColor: req.met ? "#22C55E08" : colors.background }}>
                                  <View style={{ backgroundColor: req.met ? "#22C55E18" : "#6B728018", borderRadius: 10, padding: 8 }}><Feather name={req.icon} size={16} color={req.met ? "#22C55E" : "#6B7280"} /></View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{req.label}</Text>
                                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                                      Current: <Text style={{ fontFamily: "Inter_700Bold", color: req.met ? "#22C55E" : colors.foreground }}>{req.current}{req.unit}</Text>{"  "}Required: <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground }}>{req.required}{req.unit}</Text>
                                    </Text>
                                  </View>
                                  <Feather name={req.met ? "check-circle" : "circle"} size={18} color={req.met ? "#22C55E" : "#6B7280"} />
                                </View>
                              ))}
                              <View style={{ backgroundColor: colors.primary + "10", borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "30", padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
                                <Feather name="info" size={13} color={colors.primary} />
                                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.primary, flex: 1 }}>Earn reputation by backing projects, submitting capsules, and completing verified actions across the ecosystem.</Text>
                              </View>
                            </View>
                          </Pressable>
                        </Pressable>
                      </Modal>
                    </>
                  );
                })()}
              </View>

              <MyAssetsSection colors={colors} />

              {/* ── 6. Support & Legal ── */}
              <SectionLabel label="SUPPORT & LEGAL" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SettingsRow
                  icon="help-circle"
                  iconBg="#0EA5E9"
                  title="Help Center / Report a Bug"
                  sub="Contact the Nexus team with questions or submit a bug report to help improve the platform."
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={() => Alert.alert("Help Center", "Send your feedback to: support@nexuspi.app\n\nOr visit our community forum for help and feature requests.")}
                  colors={colors}
                />
                <SettingsRow
                  icon="file-text"
                  iconBg="#6366F1"
                  title="Terms of Service"
                  sub="Read the full terms governing your use of the Nexus platform and Pi Network integrations."
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={() => Alert.alert("Terms of Service", "Full terms available at nexuspi.app/terms")}
                  colors={colors}
                />
                <SettingsRow
                  icon="lock"
                  iconBg="#8B5CF6"
                  title="Privacy Policy"
                  sub="Learn how Nexus collects, uses, and protects your personal data and Pi wallet information."
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={() => Alert.alert("Privacy Policy", "Full policy available at nexuspi.app/privacy")}
                  colors={colors}
                />
              </View>

              {/* ── Appearance ── */}
              <SectionLabel label="APPEARANCE" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SettingsRow
                  icon="sun"
                  iconBg="#F59E0B"
                  title="Theme"
                  sub={themeMode === "system" ? "System Default — follows your device setting." : themeMode === "dark" ? "Dark Mode active." : "Light Mode active."}
                  trailing={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ backgroundColor: colors.cardElevated, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground }}>{themeMode === "system" ? "SYSTEM" : themeMode.toUpperCase()}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </View>
                  }
                  onPress={() => setThemeModalVisible(true)}
                  colors={colors}
                />
              </View>

              {/* ── Storage ── */}
              <SectionLabel label="STORAGE & PERFORMANCE" colors={colors} />
              <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SettingsRow
                  icon="trash-2"
                  iconBg="#6B7280"
                  title="Clear Cache"
                  sub="Free up space and refresh app performance by clearing temporary cached data."
                  trailing={<Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
                  onPress={handleClearCache}
                  colors={colors}
                />
              </View>

              <Pressable
                onPress={signOut}
                style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 12, backgroundColor: "#EF444415", borderRadius: 16, marginTop: 8, paddingVertical: 16, borderWidth: 1, borderColor: "#EF444440", opacity: pressed ? 0.7 : 1 })}
              >
                <Feather name="log-out" size={18} color="#EF4444" />
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#EF4444" }}>Sign Out</Text>
              </Pressable>

              {/* ── Account Deletion ── */}
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, borderRadius: 16, marginTop: 6, paddingVertical: 14, opacity: pressed || deletingAccount ? 0.5 : 1 })}
              >
                {deletingAccount ? <ActivityIndicator size="small" color="#9F1239" /> : <Feather name="user-x" size={14} color="#9F1239" />}
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#9F1239" }}>Delete Account Permanently</Text>
              </Pressable>
              <Text style={{ textAlign: "center" as const, fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginHorizontal: 24, marginBottom: 4 }}>Permanently erase your account, active pitches, and personal data from the network.</Text>

              <Text style={{ textAlign: "center" as const, fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, marginBottom: 4 }}>Nexus for Pi Network · v1.0.0</Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
    </>
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

function Toggle({ active, onToggle, colors }: { active: boolean; onToggle: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable onPress={onToggle}>
      <View style={[sm.toggle, { backgroundColor: active ? colors.primary : colors.cardElevated }]}>
        <View style={[sm.toggleThumb, { transform: [{ translateX: active ? 20 : 2 }] }]} />
      </View>
    </Pressable>
  );
}

function SettingsRow({ icon, iconBg, title, sub, trailing, onPress, colors }: {
  icon: string; iconBg: string; title: string; sub: string; trailing?: any; onPress?: () => void; colors: ReturnType<typeof useColors>;
}) {
  const body = (
    <>
      <View style={[sm.walletIcon, { backgroundColor: iconBg + "22", marginRight: 12 }]}>
        <Feather name={icon as any} size={16} color={iconBg} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[sm.toggleLabel, { color: colors.foreground }]}>{title}</Text>
        <Text style={[sm.toggleSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
      {trailing ?? null}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }: any) => [sm.toggleRow, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return <View style={[sm.toggleRow, { borderTopColor: colors.border }]}>{body}</View>;
}

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.9, marginBottom: 8, marginTop: 20 }}>
      {label}
    </Text>
  );
}

function InvestorDashboard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { token } = useAuth();
  const { data: txs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/transactions/me"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/transactions/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const STATUS_COLOR: Record<string, string> = { pending: "#F59E0B", success: "#22C55E", active: "#3B82F6", invest: "#22C55E", donate: "#EF4444", hire: "#8B5CF6" };
  const STATUS_LABEL: Record<string, string> = { pending: "Pending", success: "Success", active: "Active in Escrow", invest: "Active in Escrow", donate: "Donation Sent", hire: "Hired" };

  if (isLoading) return null;
  const list = txs ?? [];
  if (list.length === 0) return null;

  return (
    <View style={[sm.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[sm.sectionTitle, { color: colors.foreground }]}>Transaction History</Text>
      {list.slice(0, 8).map((tx: any, i: number) => {
        const col = STATUS_COLOR[tx.type] ?? STATUS_COLOR[tx.status] ?? "#6B7280";
        const label = STATUS_LABEL[tx.type] ?? STATUS_LABEL[tx.status] ?? "Processed";
        return (
          <Pressable
            key={tx.id}
            onPress={tx.pitchId ? () => router.push(`/pitch/${tx.pitchId}`) : undefined}
            style={({ pressed }: any) => [sm.assetRow, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 1 : StyleSheet.hairlineWidth, opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={[sm.assetIcon, { backgroundColor: col + "18" }]}>
              <Feather name={tx.type === "donate" ? "heart" : tx.type === "hire" ? "tool" : "trending-up"} size={14} color={col} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>
                {tx.pitchId ? `Project · ${tx.pitchId.slice(0, 10)}…` : "Transaction"}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "—"}{tx.pitchId ? " · Tap to view →" : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 3 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: col }}>{tx.amount} π</Text>
              <View style={{ backgroundColor: col + "18", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: col, letterSpacing: 0.3 }}>{label.toUpperCase()}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
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
            onPress={() => {
              const rep = (me as any).reputationScore ?? 0;
              const isVal = me.role === "validator" || me.role === "admin";
              if (isVal || rep >= 85) {
                router.push("/admin");
              } else {
                Alert.alert(
                  "Validator Portal Locked",
                  `You need 85+ reputation to access the Validator Portal.\n\nYour current score: ${rep}/100.\n\nEarn rep by backing projects, delivering milestones, and completing escrow agreements.`
                );
              }
            }}
          />
          <ActionTile
            icon="package"
            label="Wardrobe"
            color="#F59E0B"
            onPress={() => router.push("/nft-marketplace")}
          />
        </View>
      </View>

      <View style={[styles.section, { paddingHorizontal: 16 }]}>
        <InvestorDashboard colors={colors} />
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
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionTile: { width: "21.5%", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 6 },
  actionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 14 },
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
