import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

type Tab = "overview" | "escrows" | "users" | "audit" | "settings";
type AdminUser = {
  id: string;
  handle: string;
  email: string | null;
  name: string;
  role: string;
  accountStatus: string;
  kycStatus: string;
  reputationScore: number;
  createdAt: string;
};
type Escrow = {
  id: string;
  projectId: string;
  status: string;
  disputeStatus: string | null;
  totalPiCommitted: number;
  updatedAt: string;
  buyer: { name: string; handle: string } | null;
  seller: { name: string; handle: string } | null;
  resolutionAvailable: boolean;
};
type Analytics = {
  totalPlatformRevenue: number;
  monthlyRevenue: number;
  pendingEscrowFunds: number;
  activeSubscriptions: number;
  grossVolume: number;
  feeTransactionCount: number;
  breakdown: { feeType: string; total: number; count: number }[];
  recentFees: { id: string; feeType: string; feeAmount: number; grossAmount: number; createdAt: string }[];
};
type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  userId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};
type Settings = {
  escrowFeePercent: number;
  withdrawalFlatFee: number;
  featuredPitchFee: number;
  kycVerificationFee: number;
  nftRoyaltyFeePercent: number;
};

class ForbiddenError extends Error {}

async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (response.status === 403) throw new ForbiddenError("Admin access required");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed");
  return payload as T;
}

function formatPi(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} π`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function AdminCard({ children, colors, style }: { children: React.ReactNode; colors: ReturnType<typeof useColors>; style?: object }) {
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

function ActionButton({
  label,
  icon,
  onPress,
  colors,
  destructive = false,
  disabled = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const color = destructive ? colors.destructive : colors.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.actionButton, { borderColor: color, backgroundColor: `${color}12`, opacity: pressed || disabled ? 0.55 : 1 }]}>
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.actionButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const wide = width >= 760;

  const load = async (showSpinner = true) => {
    if (!token || !isAdmin) {
      setLoading(false);
      return;
    }
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [nextAnalytics, nextEscrows, nextUsers, nextAudit, nextSettings] = await Promise.all([
        apiFetch<Analytics>("/api/admin/analytics/revenue", token),
        apiFetch<Escrow[]>("/api/admin/escrows", token),
        apiFetch<AdminUser[]>("/api/admin/users?limit=50", token),
        apiFetch<AuditLog[]>("/api/admin/audit-logs?limit=50", token),
        apiFetch<Settings>("/api/admin/settings", token),
      ]);
      setAnalytics(nextAnalytics);
      setEscrows(nextEscrows);
      setUsers(nextUsers);
      setAuditLogs(nextAudit);
      setSettings(nextSettings);
      setForbidden(false);
    } catch (cause) {
      if (cause instanceof ForbiddenError) setForbidden(true);
      else setError(cause instanceof Error ? cause.message : "Could not load the admin dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, isAdmin]);

  const pendingEscrows = useMemo(() => escrows.filter((escrow) => escrow.resolutionAvailable), [escrows]);

  const resolveEscrow = (escrow: Escrow, decision: "release_founder" | "refund_buyer") => {
    const label = decision === "release_founder" ? "release funds to the founder" : "refund the buyer";
    Alert.alert("Confirm settlement", `This will ${label} for ${formatPi(escrow.totalPiCommitted)}. The decision is recorded in the audit trail.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: decision === "refund_buyer" ? "destructive" : "default",
        onPress: async () => {
          setSaving(escrow.id);
          try {
            await apiFetch(`/api/admin/escrows/${escrow.id}/resolve`, token!, { method: "POST", body: JSON.stringify({ decision }) });
            await load(false);
          } catch (cause) {
            Alert.alert("Settlement failed", cause instanceof Error ? cause.message : "The escrow could not be resolved");
          } finally {
            setSaving(null);
          }
        },
      },
    ]);
  };

  const updateUser = async (target: AdminUser, patch: { role?: string; accountStatus?: string }) => {
    setSaving(target.id);
    try {
      await apiFetch(`/api/admin/users/${target.id}/status`, token!, { method: "PATCH", body: JSON.stringify(patch) });
      await load(false);
    } catch (cause) {
      Alert.alert("User update failed", cause instanceof Error ? cause.message : "The user could not be updated");
    } finally {
      setSaving(null);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving("settings");
    try {
      const updated = await apiFetch<Settings>("/api/admin/settings", token!, { method: "PATCH", body: JSON.stringify(settings) });
      setSettings(updated);
      Alert.alert("Saved", "Platform fee settings were updated.");
    } catch (cause) {
      Alert.alert("Save failed", cause instanceof Error ? cause.message : "Settings could not be saved");
    } finally {
      setSaving(null);
    }
  };

  if (!isAdmin || forbidden) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background, padding: 30 }]}>
        <View style={[styles.forbiddenIcon, { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}40` }]}>
          <Feather name="shield-off" size={34} color={colors.destructive} />
        </View>
        <Text style={[styles.forbiddenTitle, { color: colors.foreground }]}>403 · Admin access required</Text>
        <Text style={[styles.forbiddenBody, { color: colors.mutedForeground }]}>This workspace is restricted to platform administrators. Your account has not been granted access.</Text>
        <Pressable onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Return to workspace</Text>
        </Pressable>
      </View>
    );
  }

  const statCards = analytics ? [
    { label: "Platform revenue", value: formatPi(analytics.totalPlatformRevenue), icon: "trending-up" as const, tone: colors.success },
    { label: "This month", value: formatPi(analytics.monthlyRevenue), icon: "calendar" as const, tone: colors.primary },
    { label: "Pending escrow", value: formatPi(analytics.pendingEscrowFunds), icon: "lock" as const, tone: colors.warning },
    { label: "Paid memberships", value: analytics.activeSubscriptions.toLocaleString(), icon: "users" as const, tone: colors.accent },
  ] : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.iconButton, { backgroundColor: colors.cardElevated }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Platform Console</Text>
            <View style={[styles.rolePill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}45` }]}>
              <Feather name="shield" size={11} color={colors.primary} />
              <Text style={[styles.rolePillText, { color: colors.primary }]}>{user?.role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}</Text>
            </View>
          </View>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Financial controls, trust operations, and audit visibility</Text>
        </View>
        <Pressable onPress={() => { setRefreshing(true); void load(false); }} hitSlop={10} style={[styles.iconButton, { backgroundColor: colors.cardElevated }]}>
          <Feather name="refresh-cw" size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([
          ["overview", "Overview", "bar-chart-2"],
          ["escrows", `Escrow${pendingEscrows.length ? ` · ${pendingEscrows.length}` : ""}`, "lock"],
          ["users", "Users & KYC", "users"],
          ["audit", "Audit trail", "file-text"],
          ["settings", "Fee settings", "sliders"],
        ] as const).map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, { borderBottomColor: tab === key ? colors.primary : "transparent" }]}>
            <Feather name={icon} size={14} color={tab === key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabText, { color: tab === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false); }} tintColor={colors.primary} />}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, maxWidth: 1180, width: "100%", alignSelf: "center" }]}
          showsVerticalScrollIndicator={false}
        >
          {error && <View style={[styles.errorBanner, { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}35` }]}><Feather name="alert-triangle" size={15} color={colors.destructive} /><Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text></View>}

          {tab === "overview" && (
            <>
              <View style={styles.sectionIntro}>
                <View><Text style={[styles.pageTitle, { color: colors.foreground }]}>Revenue overview</Text><Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Live totals from the platform fee ledger. No estimated or mock values.</Text></View>
                <View style={[styles.livePill, { backgroundColor: `${colors.success}15` }]}><View style={[styles.liveDot, { backgroundColor: colors.success }]} /><Text style={[styles.liveText, { color: colors.success }]}>LIVE DATA</Text></View>
              </View>
              <View style={[styles.statsGrid, { gap: 12 }]}>
                {statCards.map((stat) => <AdminCard key={stat.label} colors={colors} style={[styles.statCard, { width: wide ? "23.5%" : "48%" }]}><View style={[styles.statIcon, { backgroundColor: `${stat.tone}18` }]}><Feather name={stat.icon} size={17} color={stat.tone} /></View><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text></AdminCard>)}
              </View>
              <View style={styles.twoColumns}>
                <AdminCard colors={colors} style={styles.flexCard}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Ledger breakdown</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{analytics?.feeTransactionCount ?? 0} recorded fee transactions · {formatPi(analytics?.grossVolume ?? 0)} gross volume</Text>
                  {(analytics?.breakdown ?? []).length === 0 ? <EmptyState colors={colors} icon="pie-chart" text="No fee transactions have been recorded yet." /> : analytics?.breakdown.map((row) => <View key={row.feeType} style={styles.dataRow}><View style={{ flex: 1 }}><Text style={[styles.dataLabel, { color: colors.foreground }]}>{row.feeType.replaceAll("_", " ")}</Text><Text style={[styles.dataMeta, { color: colors.mutedForeground }]}>{row.count} transactions</Text></View><Text style={[styles.dataAmount, { color: colors.primary }]}>{formatPi(row.total)}</Text></View>)}
                </AdminCard>
                <AdminCard colors={colors} style={styles.flexCard}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent platform fees</Text>
                  {(analytics?.recentFees ?? []).length === 0 ? <EmptyState colors={colors} icon="activity" text="Revenue activity will appear here after the first settlement." /> : analytics?.recentFees.slice(0, 5).map((fee) => <View key={fee.id} style={styles.dataRow}><View style={{ flex: 1 }}><Text style={[styles.dataLabel, { color: colors.foreground }]}>{fee.feeType.replaceAll("_", " ")}</Text><Text style={[styles.dataMeta, { color: colors.mutedForeground }]}>{formatDate(fee.createdAt)} · gross {formatPi(fee.grossAmount)}</Text></View><Text style={[styles.dataAmount, { color: colors.success }]}>+{formatPi(fee.feeAmount)}</Text></View>)}
                </AdminCard>
              </View>
            </>
          )}

          {tab === "escrows" && (
            <>
              <View style={styles.sectionIntro}><View><Text style={[styles.pageTitle, { color: colors.foreground }]}>Escrow & disputes</Text><Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Resolve locked agreements with an atomic fee and audit record.</Text></View><View style={[styles.countPill, { backgroundColor: `${colors.warning}18` }]}><Text style={[styles.countText, { color: colors.warning }]}>{pendingEscrows.length} pending</Text></View></View>
              {escrows.length === 0 ? <EmptyState colors={colors} icon="inbox" text="There are no active or disputed escrow agreements." /> : escrows.map((escrow) => <AdminCard key={escrow.id} colors={colors}><View style={styles.rowHeader}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{escrow.buyer?.name ?? "Unknown buyer"} → {escrow.seller?.name ?? "Unknown founder"}</Text><Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{escrow.projectId} · updated {formatDate(escrow.updatedAt)}</Text></View><View style={[styles.statusPill, { backgroundColor: escrow.status === "DISPUTED" ? `${colors.destructive}15` : `${colors.warning}15` }]}><Text style={[styles.statusText, { color: escrow.status === "DISPUTED" ? colors.destructive : colors.warning }]}>{escrow.status.replaceAll("_", " ")}</Text></View></View><View style={styles.amountBand}><Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>Committed in escrow</Text><Text style={[styles.amountValue, { color: colors.foreground }]}>{formatPi(escrow.totalPiCommitted)}</Text></View>{escrow.resolutionAvailable && <View style={styles.actionsRow}><ActionButton label="Refund buyer" icon="corner-up-left" colors={colors} destructive disabled={saving === escrow.id} onPress={() => resolveEscrow(escrow, "refund_buyer")} /><ActionButton label="Release to founder" icon="check-circle" colors={colors} disabled={saving === escrow.id} onPress={() => resolveEscrow(escrow, "release_founder")} /></View>}</AdminCard>)}
            </>
          )}

          {tab === "users" && (
            <>
              <View style={styles.sectionIntro}><View><Text style={[styles.pageTitle, { color: colors.foreground }]}>Users & KYC controls</Text><Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Manage account access and role assignment from the server-authorized directory.</Text></View></View>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, handle, or email" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} />
              {users.filter((entry) => `${entry.name} ${entry.handle} ${entry.email ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((entry) => <AdminCard key={entry.id} colors={colors}><View style={styles.rowHeader}><View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{entry.name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{entry.name}</Text><Text style={[styles.cardSub, { color: colors.mutedForeground }]}>@{entry.handle} · {entry.email ?? "No email"} · rep {entry.reputationScore}</Text></View><View style={[styles.statusPill, { backgroundColor: entry.accountStatus === "active" ? `${colors.success}15` : `${colors.destructive}15` }]}><Text style={[styles.statusText, { color: entry.accountStatus === "active" ? colors.success : colors.destructive }]}>{entry.accountStatus}</Text></View></View><View style={styles.userMeta}><Text style={[styles.dataMeta, { color: colors.mutedForeground }]}>Role: <Text style={{ color: colors.foreground }}>{entry.role}</Text></Text><Text style={[styles.dataMeta, { color: colors.mutedForeground }]}>KYC: <Text style={{ color: colors.foreground }}>{entry.kycStatus}</Text></Text></View><View style={styles.actionsRow}>{entry.accountStatus === "active" ? <ActionButton label="Suspend" icon="pause-circle" colors={colors} destructive disabled={saving === entry.id} onPress={() => updateUser(entry, { accountStatus: "suspended" })} /> : <ActionButton label="Restore access" icon="check-circle" colors={colors} disabled={saving === entry.id} onPress={() => updateUser(entry, { accountStatus: "active" })} />}{entry.role !== "validator" && entry.role !== "admin" && entry.role !== "super_admin" && <ActionButton label="Make validator" icon="shield" colors={colors} disabled={saving === entry.id} onPress={() => updateUser(entry, { role: "validator" })} />}</View></AdminCard>)}
              {users.length === 0 && <EmptyState colors={colors} icon="users" text="No users match the current directory." />}
            </>
          )}

          {tab === "audit" && (
            <>
              <View style={styles.sectionIntro}><View><Text style={[styles.pageTitle, { color: colors.foreground }]}>Audit trail</Text><Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Sanitized administrative actions and financial decisions.</Text></View></View>
              {auditLogs.length === 0 ? <EmptyState colors={colors} icon="file-text" text="No audit events have been recorded yet." /> : auditLogs.map((log) => <AdminCard key={log.id} colors={colors}><View style={styles.rowHeader}><View style={[styles.auditIcon, { backgroundColor: `${colors.primary}18` }]}><Feather name="activity" size={15} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.dataLabel, { color: colors.foreground }]}>{log.action.replaceAll("_", " ")}</Text><Text style={[styles.dataMeta, { color: colors.mutedForeground }]}>{log.entityType} · {log.entityId} · {formatDate(log.createdAt)}</Text></View></View><Text style={[styles.auditMeta, { color: colors.mutedForeground }]}>Actor {log.actorId}{log.ipAddress ? ` · IP hash ${log.ipAddress.slice(0, 12)}…` : ""}</Text></AdminCard>)}
            </>
          )}

          {tab === "settings" && settings && (
            <>
              <View style={styles.sectionIntro}><View><Text style={[styles.pageTitle, { color: colors.foreground }]}>Platform fee settings</Text><Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Changes apply to future settlement calculations and are audit logged.</Text></View></View>
              <AdminCard colors={colors}><SettingField label="Escrow fee" suffix="%" value={settings.escrowFeePercent} onChange={(value) => setSettings({ ...settings, escrowFeePercent: value })} colors={colors} /><SettingField label="Withdrawal flat fee" suffix="π" value={settings.withdrawalFlatFee} onChange={(value) => setSettings({ ...settings, withdrawalFlatFee: value })} colors={colors} /><SettingField label="Featured pitch fee" suffix="π" value={settings.featuredPitchFee} onChange={(value) => setSettings({ ...settings, featuredPitchFee: value })} colors={colors} /><SettingField label="KYC verification fee" suffix="π" value={settings.kycVerificationFee} onChange={(value) => setSettings({ ...settings, kycVerificationFee: value })} colors={colors} /><SettingField label="NFT royalty" suffix="%" value={settings.nftRoyaltyFeePercent} onChange={(value) => setSettings({ ...settings, nftRoyaltyFeePercent: value })} colors={colors} /><Pressable onPress={saveSettings} disabled={saving === "settings"} style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 10, opacity: saving === "settings" ? 0.6 : 1 }]}>{saving === "settings" ? <ActivityIndicator color={colors.primaryForeground} /> : <><Feather name="save" size={15} color={colors.primaryForeground} /><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Save fee settings</Text></>}</Pressable></AdminCard>
              <View style={[styles.infoBox, { backgroundColor: `${colors.primary}0C`, borderColor: `${colors.primary}30` }]}><Feather name="info" size={15} color={colors.primary} /><Text style={[styles.infoText, { color: colors.mutedForeground }]}>All values are stored as decimal amounts. Existing agreement rows are never rewritten when settings change.</Text></View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyState({ colors, icon, text }: { colors: ReturnType<typeof useColors>; icon: React.ComponentProps<typeof Feather>["name"]; text: string }) {
  return <View style={styles.empty}><Feather name={icon} size={28} color={colors.mutedForeground} /><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text></View>;
}

function SettingField({ label, suffix, value, onChange, colors }: { label: string; suffix: string; value: number; onChange: (value: number) => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text><View style={[styles.settingInputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}><TextInput value={String(value)} keyboardType="decimal-pad" onChangeText={(next) => onChange(Number(next.replace(",", ".")) || 0)} style={[styles.settingInput, { color: colors.foreground }]} /><Text style={[styles.settingSuffix, { color: colors.mutedForeground }]}>{suffix}</Text></View></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  iconButton: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  rolePillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tabs: { paddingHorizontal: 14, borderBottomWidth: 1, gap: 3 },
  tab: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, paddingVertical: 13, borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  content: { padding: 18, gap: 16 },
  sectionIntro: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14 },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  pageSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 5, lineHeight: 18 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap" },
  statCard: { minHeight: 132, padding: 15 },
  statIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, marginBottom: 12 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 4 },
  twoColumns: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  flexCard: { flex: 1, minWidth: 300 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 17 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#0000000D" },
  dataLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  dataMeta: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 },
  dataAmount: { fontSize: 13, fontFamily: "Inter_700Bold" },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 9, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  countPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  amountBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15, padding: 12, borderRadius: 11, backgroundColor: "#00000008" },
  amountLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  amountValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 },
  actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  actionButtonText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  searchInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, fontFamily: "Inter_400Regular" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  userMeta: { flexDirection: "row", gap: 18, marginTop: 14 },
  auditIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  auditMeta: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 12 },
  empty: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 11, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 15, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#0000000D" },
  settingLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  settingInputWrap: { flexDirection: "row", alignItems: "center", width: 130, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  settingInput: { flex: 1, paddingVertical: 9, textAlign: "right", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  settingSuffix: { fontSize: 12, fontFamily: "Inter_500Medium", marginLeft: 6 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 12 },
  primaryButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  infoBox: { flexDirection: "row", gap: 9, padding: 13, borderWidth: 1, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17 },
  forbiddenIcon: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  forbiddenTitle: { fontSize: 21, fontFamily: "Inter_700Bold", textAlign: "center" },
  forbiddenBody: { maxWidth: 360, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginTop: 10, marginBottom: 22 },
});