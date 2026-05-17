import { Feather } from "@expo/vector-icons";
import { useListPitches } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { Header } from "@/components/Header";
import {
  EMPTY_FILTERS,
  HubFiltersSheet,
  activeFilterCount,
  fundingBandMatches,
  type HubFilters,
} from "@/components/HubFiltersSheet";
import { PitchCard } from "@/components/PitchCard";
import { PitchComposerSheet } from "@/components/PitchComposerSheet";
import { SegmentControl } from "@/components/SegmentControl";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const STAGES = ["All", "Pre-seed", "Seed", "Series A", "Series B"];
const SERVICE_CATEGORIES = ["All", "Development", "Design", "Marketing", "Logistics", "Legal", "Copywriting", "Finance"];

type HubTab = "pitches" | "services";

type ServiceApp = {
  id: string;
  title: string;
  category: string;
  description: string;
  pricePi: number;
  rating: number;
  trustScore: number;
  city?: string;
  country?: string;
  hiredCount: number;
  portfolioUrl?: string;
  provider: { id: string; name: string; handle: string; avatarKey: string | null; verified: boolean; city: string } | null;
};

function ServiceCard({ service }: { service: ServiceApp }) {
  const colors = useColors();
  const stars = Math.round(service.rating);

  const CAT_COLORS: Record<string, string> = {
    Development: "#6366F1", Design: "#EC4899", Marketing: "#F59E0B",
    Logistics: "#10B981", Legal: "#8B5CF6", Copywriting: "#0EA5E9",
    Finance: "#14B8A6",
  };
  const catColor = CAT_COLORS[service.category] ?? colors.primary;

  return (
    <Pressable
      onPress={() => service.provider && router.push(`/profile/${service.provider.id}`)}
      style={({ pressed }) => [sc.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={sc.header}>
        <View style={[sc.catBadge, { backgroundColor: catColor + "18", borderColor: catColor + "40" }]}>
          <Text style={[sc.catText, { color: catColor }]}>{service.category}</Text>
        </View>
        {service.trustScore >= 70 && (
          <View style={[sc.trustedBadge, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
            <Feather name="shield" size={10} color={colors.success} />
            <Text style={[sc.trustedText, { color: colors.success }]}>Trusted</Text>
          </View>
        )}
      </View>

      <Text style={[sc.title, { color: colors.foreground }]}>{service.title}</Text>
      <Text style={[sc.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{service.description}</Text>

      <View style={sc.providerRow}>
        <Avatar avatarKey={service.provider?.avatarKey ?? null} size={28} />
        <View style={{ flex: 1 }}>
          <Text style={[sc.providerName, { color: colors.foreground }]}>{service.provider?.name ?? "Provider"}</Text>
          <Text style={[sc.providerCity, { color: colors.mutedForeground }]}>{service.city ?? service.provider?.city ?? "Global"}</Text>
        </View>
        <View style={sc.ratingRow}>
          {"★★★★★".split("").map((_, i) => (
            <Text key={i} style={[sc.star, { color: i < stars ? colors.tip : colors.border }]}>★</Text>
          ))}
        </View>
      </View>

      <View style={[sc.footer, { borderTopColor: colors.border }]}>
        <View style={[sc.priceTag, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[sc.priceText, { color: colors.primary }]}>
            {service.pricePi === 0 ? "Contact for price" : `From ${service.pricePi} π`}
          </Text>
        </View>
        <Text style={[sc.hired, { color: colors.mutedForeground }]}>{service.hiredCount} hired</Text>
      </View>
    </Pressable>
  );
}

const sc = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  trustedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  trustedText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  providerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  providerCity: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  ratingRow: { flexDirection: "row" },
  star: { fontSize: 13 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1 },
  priceTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  priceText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hired: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

export default function PitchesScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const [hubTab, setHubTab] = useState<HubTab>("pitches");
  const [stage, setStage] = useState("All");
  const [serviceCategory, setServiceCategory] = useState("All");
  const [composerOpen, setComposerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<HubFilters>(EMPTY_FILTERS);

  const { data: pitches, isLoading: pitchesLoading } = useListPitches();
  const { data: services, isLoading: servicesLoading } = useQuery<ServiceApp[]>({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/services`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!token,
  });

  const list = pitches ?? [];
  const serviceList = services ?? [];

  const visiblePitches = useMemo(() => {
    return list.filter((p) => {
      if ((p as any).entityType === "service_app") return false;
      if (stage !== "All" && p.stage !== stage) return false;
      if (filters.industries.length > 0 && !filters.industries.includes(p.industry)) return false;
      if (filters.cities.length > 0 && !filters.cities.includes(p.city)) return false;
      if (!fundingBandMatches(p.raising, filters.funding)) return false;
      return true;
    });
  }, [list, stage, filters]);

  const visibleServices = useMemo(() => {
    if (serviceCategory === "All") return serviceList;
    return serviceList.filter((s) => s.category === serviceCategory);
  }, [serviceList, serviceCategory]);

  const totalRaising = visiblePitches.reduce((s, p) => s + (p.raising - p.raised), 0);
  const filterCount = activeFilterCount(filters);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Investment Hub"
        subtitle="Curated deal flow"
        rightIcon="filter"
        onRightPress={() => setFiltersOpen(true)}
      />

      {/* Main tab switcher */}
      <View style={[styles.mainTabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setHubTab("pitches")} style={[styles.mainTab, { borderBottomColor: hubTab === "pitches" ? colors.primary : "transparent" }]}>
          <Feather name="zap" size={14} color={hubTab === "pitches" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.mainTabText, { color: hubTab === "pitches" ? colors.primary : colors.mutedForeground }]}>Pitches</Text>
        </Pressable>
        <Pressable onPress={() => setHubTab("services")} style={[styles.mainTab, { borderBottomColor: hubTab === "services" ? colors.primary : "transparent" }]}>
          <Feather name="grid" size={14} color={hubTab === "services" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.mainTabText, { color: hubTab === "services" ? colors.primary : colors.mutedForeground }]}>
            Services {serviceList.length > 0 ? `(${serviceList.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {hubTab === "pitches" && (
        <FlatList
          data={visiblePitches}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PitchCard pitch={item} />}
          ListHeaderComponent={
            <View>
              <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>OPEN ALLOCATION</Text>
                  <Text style={[styles.heroValue, { color: colors.foreground }]}>{(totalRaising / 1_000_000).toFixed(1)}M π</Text>
                  <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>across {visiblePitches.length} live {visiblePitches.length === 1 ? "round" : "rounds"}</Text>
                </View>
                <Pressable onPress={() => setComposerOpen(true)} style={({ pressed }) => [styles.heroBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.heroBtnText, { color: colors.primaryForeground }]}>Pitch</Text>
                </Pressable>
              </View>

              <View style={{ paddingVertical: 12 }}>
                <SegmentControl options={STAGES} value={stage} onChange={setStage} scrollable />
              </View>

              {filterCount > 0 && (
                <View style={styles.activeFilterRow}>
                  <Pressable onPress={() => setFiltersOpen(true)} style={[styles.activeFilterChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
                    <Feather name="sliders" size={12} color={colors.primary} />
                    <Text style={[styles.activeFilterText, { color: colors.primary }]}>{filterCount} filter{filterCount === 1 ? "" : "s"} active</Text>
                  </Pressable>
                  <Pressable onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={6}>
                    <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            pitchesLoading ? (
              <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={styles.empty}>
                <Feather name="briefcase" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {filterCount > 0 || stage !== "All" ? "No rounds match your filters" : "No live rounds yet"}
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {filterCount > 0 || stage !== "All" ? "Try clearing a filter or widening the stage." : "Be the first to publish a pitch to the Hub."}
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {hubTab === "services" && (
        <FlatList
          data={visibleServices}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <ServiceCard service={item} />}
          ListHeaderComponent={
            <View>
              <View style={[styles.servicesHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>SERVICE MARKETPLACE</Text>
                  <Text style={[styles.heroValue, { color: colors.foreground }]}>{serviceList.length}</Text>
                  <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>providers accepting Pi</Text>
                </View>
                <View style={[styles.marketplaceBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
                  <Text style={[styles.marketplaceBadgeText, { color: colors.primary }]}>π Economy</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                {SERVICE_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setServiceCategory(cat)}
                    style={({ pressed }) => [styles.catChip, {
                      backgroundColor: serviceCategory === cat ? colors.primary : colors.card,
                      borderColor: serviceCategory === cat ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={[styles.catChipText, { color: serviceCategory === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            servicesLoading ? (
              <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={styles.empty}>
                <Feather name="grid" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No services yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Be the first to list a service and get hired in Pi.</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PitchComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} />
      <HubFiltersSheet visible={filtersOpen} initial={filters} onApply={setFilters} onClose={() => setFiltersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mainTabRow: { flexDirection: "row", borderBottomWidth: 1 },
  mainTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderBottomWidth: 2 },
  mainTabText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hero: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  servicesHero: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.4 },
  heroValue: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -1, marginTop: 6 },
  heroSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  heroBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  marketplaceBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  marketplaceBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  catChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activeFilterRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeFilterChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  activeFilterText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  clearText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
