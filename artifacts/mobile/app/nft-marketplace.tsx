import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
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

import { Avatar } from "@/components/Avatar";
import { Toast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/lib/userCache";

type SkinTier = "common" | "rare" | "epic" | "legendary";
type Skin = {
  id: string;
  name: string;
  tier: SkinTier;
  pricePi: number;
  owned: boolean;
  equipped: boolean;
  desc: string;
  aura: string | null;
  mintedTotal?: number;
};

const TIER_CFG: Record<SkinTier, { label: string; color: string; bg: string; border: string; icon: string }> = {
  common:    { label: "COMMON",    color: "#9CA3AF", bg: "#1A1E26", border: "#374151", icon: "layers" },
  rare:      { label: "RARE",      color: "#60A5FA", bg: "#0F1E35", border: "#3B82F6", icon: "award" },
  epic:      { label: "EPIC · VALIDATOR", color: "#10B981", bg: "#031A12", border: "#10B981", icon: "shield" },
  legendary: { label: "LEGENDARY · INVESTOR", color: "#F59E0B", bg: "#150E00", border: "#F59E0B", icon: "star" },
};

const DEMO_SKINS: Skin[] = [
  { id: "c1", name: "Nexus Casual",     tier: "common",    pricePi: 5,    owned: true,  equipped: false, desc: "Standard explorer outfit. Clean lines, functional design for daily Pi Network use.", aura: null },
  { id: "c2", name: "Grid Runner",      tier: "common",    pricePi: 10,   owned: false, equipped: false, desc: "Urban mesh aesthetic for the daily builder navigating the Pi ecosystem.", aura: null },
  { id: "c3", name: "Citizen Mark",     tier: "common",    pricePi: 8,    owned: false, equipped: false, desc: "The signature citizen look — minimal, recognizable, trustworthy.", aura: null },
  { id: "r1", name: "Pioneer Badge",    tier: "rare",      pricePi: 50,   owned: true,  equipped: false, desc: "Worn by early Pi adopters. Signals founding-era participation in the network.", aura: null },
  { id: "r2", name: "Nexus Scout",      tier: "rare",      pricePi: 75,   owned: false, equipped: false, desc: "For explorers who mapped the first Pi nodes and expanded the initial reach.", aura: null },
  { id: "e1", name: "Guardian Protocol",tier: "epic",      pricePi: 150,  owned: true,  equipped: true,  desc: "Unlocked through active Validator participation. Emerald signal aura for verified protectors of the ecosystem.", aura: "Guardian Glow", mintedTotal: 500 },
  { id: "e2", name: "Sentinel Mark",    tier: "epic",      pricePi: 200,  owned: false, equipped: false, desc: "Reserved for multi-project validators with perfect dispute records.", aura: "Sentinel Shield", mintedTotal: 250 },
  { id: "l1", name: "Investor Genesis", tier: "legendary", pricePi: 1000, owned: false, equipped: false, desc: "Bioluminescent golden neon aura. Only 100 minted across the entire Pi Ecosystem.", aura: "Golden Sovereign", mintedTotal: 100 },
  { id: "l2", name: "Apex Architect",   tier: "legendary", pricePi: 2500, owned: false, equipped: false, desc: "The rarest skin in existence. Worn only by those who built the foundation of the network.", aura: "Apex Crown", mintedTotal: 10 },
];

function LegendaryParticles({ color }: { color: string }) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const a4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (a: Animated.Value, dur: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(a, { toValue: -10, duration: dur, useNativeDriver: true }),
        Animated.timing(a, { toValue: 2,   duration: dur, useNativeDriver: true }),
      ])).start();
    anim(a1, 1800); anim(a2, 2400); anim(a3, 2100); anim(a4, 1600);
  }, []);

  const POS = [
    { a: a1, top: "18%", left: "8%"  },
    { a: a2, top: "45%", right: "6%" },
    { a: a3, top: "25%", left: "78%" },
    { a: a4, top: "65%", left: "18%" },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {POS.map(({ a, ...pos }, i) => (
        <Animated.Text key={i} style={[{ position: "absolute", fontSize: 11, color, transform: [{ translateY: a }] }, pos as any]}>✦</Animated.Text>
      ))}
    </View>
  );
}

function EpicPulse({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16, borderWidth: 2, borderColor: color, opacity: pulse }]} />;
}

function PiElifAvatar({ equippedSkin, me }: { equippedSkin: Skin | null; me: any }) {
  const tier: SkinTier = (equippedSkin?.tier ?? "common") as SkinTier;
  const cfg = TIER_CFG[tier];
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLegendary) {
      Animated.loop(Animated.sequence([
        Animated.timing(floatAnim, { toValue: -7, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])).start();
    } else {
      floatAnim.setValue(0);
    }
  }, [isLegendary]);

  return (
    <View style={{ alignItems: "center", paddingTop: 24, paddingBottom: 20 }}>
      <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
        <View style={{
          width: 116, height: 116, borderRadius: 58,
          backgroundColor: cfg.bg,
          borderWidth: isLegendary ? 3 : isEpic ? 2.5 : 2,
          borderColor: cfg.border,
          alignItems: "center", justifyContent: "center", overflow: "hidden",
          ...(isLegendary ? {
            shadowColor: cfg.color, shadowOpacity: 0.9,
            shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
          } : {}),
        }}>
          <Avatar avatarKey={me?.avatarKey ?? null} size={106} />
          {isLegendary && <LegendaryParticles color={cfg.color} />}
          {isEpic && <EpicPulse color={cfg.color} />}
        </View>
      </Animated.View>

      <View style={{ alignItems: "center", marginTop: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#F3F4F6" }}>
            {me?.name ?? "Pi-Elif"}
          </Text>
          {isLegendary && (
            <View style={{ backgroundColor: "#F59E0B22", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F59E0B60" }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#F59E0B", letterSpacing: 0.8 }}>✦ GILDED</Text>
            </View>
          )}
        </View>

        {equippedSkin ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: cfg.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: cfg.border }}>
            <Feather name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: cfg.color }}>
              {equippedSkin.name}
              {equippedSkin.aura ? `  ·  [Equipped Aura: ${equippedSkin.aura}]` : ""}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" }}>No skin equipped</Text>
        )}

        {isEpic && equippedSkin?.aura && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#10B98112", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: "#10B98130" }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" }}>🛡️ [Equipped Aura: {equippedSkin.aura}]</Text>
          </View>
        )}
        {isLegendary && equippedSkin?.aura && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F59E0B12", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: "#F59E0B30" }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F59E0B" }}>✦ [Equipped Aura: {equippedSkin.aura}]</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SkinCard({ skin, onBuy, onEquip, onList }: { skin: Skin; onBuy: () => void; onEquip: () => void; onList: () => void }) {
  const cfg = TIER_CFG[skin.tier];
  const isLegendary = skin.tier === "legendary";
  const isEpic = skin.tier === "epic";

  return (
    <View style={[skins.card, { backgroundColor: cfg.bg, borderColor: cfg.border + (isLegendary ? "CC" : isEpic ? "88" : "44"), borderWidth: isLegendary ? 2 : 1 }]}>
      {isEpic && <EpicPulse color={cfg.color} />}
      {isLegendary && <LegendaryParticles color={cfg.color} />}

      {/* Tier badge row */}
      <View style={[skins.tierRow, { borderBottomColor: cfg.border + "25" }]}>
        <Feather name={cfg.icon as any} size={13} color={cfg.color} />
        <Text style={[skins.tierLabel, { color: cfg.color }]}>{cfg.label}</Text>
        {skin.mintedTotal && (
          <Text style={[skins.mintedText, { color: cfg.color + "90" }]}>{skin.mintedTotal} minted</Text>
        )}
        {skin.equipped && (
          <View style={[skins.equippedBadge, { backgroundColor: cfg.color + "22", borderColor: cfg.color + "55" }]}>
            <Text style={[skins.equippedText, { color: cfg.color }]}>EQUIPPED</Text>
          </View>
        )}
        <Text style={[skins.price, { color: cfg.color }]}>
          {skin.pricePi > 0 ? `π ${skin.pricePi.toLocaleString()}` : "FREE"}
        </Text>
      </View>

      {/* Visual representation */}
      <View style={skins.visualBlock}>
        {/* Common/Rare: simple gradient card with icon */}
        {(skin.tier === "common" || skin.tier === "rare") && (
          <View style={[skins.avatarCircle, { backgroundColor: cfg.color + "18", borderColor: cfg.color + "50" }]}>
            <Feather name={cfg.icon as any} size={32} color={cfg.color} />
          </View>
        )}

        {/* Epic: shield + glow ring */}
        {isEpic && (
          <View style={{ alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View style={[skins.avatarCircle, { backgroundColor: "#10B98118", borderColor: "#10B981", borderWidth: 2.5, width: 68, height: 68, borderRadius: 34 }]}>
              <Feather name="shield" size={32} color="#10B981" />
            </View>
            {skin.aura && (
              <View style={[skins.auraBadge, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
                <Text style={[skins.auraText, { color: "#10B981" }]}>🛡️ [Equipped Aura: {skin.aura}]</Text>
              </View>
            )}
          </View>
        )}

        {/* Legendary: gilded + floating particles */}
        {isLegendary && (
          <View style={{ alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View style={[skins.avatarCircle, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B", borderWidth: 3, width: 72, height: 72, borderRadius: 36,
              shadowColor: "#F59E0B", shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
            }]}>
              <Feather name="star" size={34} color="#F59E0B" />
            </View>
            {skin.aura && (
              <View style={[skins.auraBadge, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B40" }]}>
                <Text style={[skins.auraText, { color: "#F59E0B" }]}>✦ [Equipped Aura: {skin.aura}]</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Info + actions */}
      <View style={skins.info}>
        <Text style={skins.skinName}>{skin.name}</Text>
        <Text style={skins.skinDesc}>{skin.desc}</Text>

        {skin.owned ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={onEquip}
              style={({ pressed }) => [skins.actionBtn, {
                flex: 1,
                backgroundColor: skin.equipped ? "#37415120" : cfg.color + "18",
                borderColor: skin.equipped ? "#6B7280" : cfg.color,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <Feather name={skin.equipped ? "check" : "user"} size={12} color={skin.equipped ? "#6B7280" : cfg.color} />
              <Text style={[skins.actionBtnText, { color: skin.equipped ? "#6B7280" : cfg.color }]}>
                {skin.equipped ? "Equipped" : "Equip"}
              </Text>
            </Pressable>
            {!skin.equipped && (
              <Pressable
                onPress={onList}
                style={({ pressed }) => [skins.actionBtn, { flex: 1, backgroundColor: "#37415118", borderColor: "#6B7280", opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="tag" size={12} color="#9CA3AF" />
                <Text style={[skins.actionBtnText, { color: "#9CA3AF" }]}>List for Sale</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            onPress={onBuy}
            style={({ pressed }) => [skins.buyBtn, {
              backgroundColor: cfg.color + (isLegendary ? "28" : "1A"),
              borderColor: cfg.color,
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Feather name="shopping-bag" size={13} color={cfg.color} />
            <Text style={[skins.buyBtnText, { color: cfg.color }]}>Buy — π {skin.pricePi.toLocaleString()}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function NftMarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();

  const [tab, setTab] = useState<"marketplace" | "wardrobe">("marketplace");
  const [skinsState, setSkinsState] = useState<Skin[]>(DEMO_SKINS);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("success");

  const fire = (msg: string, type: typeof toastType = "success") => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  };

  const equippedSkin = skinsState.find(s => s.equipped) ?? null;
  const ownedSkins = skinsState.filter(s => s.owned);
  const marketSkins = skinsState.filter(s => !s.owned);

  const handleBuy = (id: string) => {
    const skin = skinsState.find(s => s.id === id);
    if (!skin) return;
    setSkinsState(prev => prev.map(s => s.id === id ? { ...s, owned: true } : s));
    setBuyingId(null);
    fire(`${skin.name} added to your Wardrobe!`);
  };

  const handleEquip = (id: string) => {
    const skin = skinsState.find(s => s.id === id);
    if (!skin) return;
    const wasEquipped = skin.equipped;
    setSkinsState(prev => prev.map(s => ({ ...s, equipped: s.id === id ? !s.equipped : false })));
    fire(wasEquipped ? "Skin unequipped." : `${skin.name} equipped!`);
  };

  const handleList = (id: string) => {
    const price = parseInt(listPrice, 10);
    if (!price || price <= 0) { fire("Enter a valid price in π.", "error"); return; }
    const skin = skinsState.find(s => s.id === id);
    setSkinsState(prev => prev.map(s => s.id === id ? { ...s, pricePi: price } : s));
    setListingId(null); setListPrice("");
    fire(`${skin?.name ?? "Skin"} listed for π ${price.toLocaleString()}!`);
  };

  const buyingSkin = skinsState.find(s => s.id === buyingId);
  const listingSkin = skinsState.find(s => s.id === listingId);
  const totalValue = ownedSkins.reduce((acc, s) => acc + s.pricePi, 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#080B12" }}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />

      {/* Header */}
      <View style={[mkt.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={mkt.backBtn}>
          <Feather name="arrow-left" size={18} color="#F3F4F6" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={mkt.headerTitle}>NFT Skins Marketplace</Text>
          <Text style={mkt.headerSub}>Pi-Elif · Avatar Wardrobe</Text>
        </View>
        {totalValue > 0 && (
          <View style={mkt.valueBadge}>
            <Text style={mkt.valueText}>π {totalValue.toLocaleString()}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Pi-Elif Avatar */}
        <PiElifAvatar equippedSkin={equippedSkin} me={me} />

        {/* Tabs */}
        <View style={mkt.tabRow}>
          {([
            { key: "marketplace", label: "Marketplace",  icon: "shopping-bag" },
            { key: "wardrobe",    label: "My Wardrobe",  icon: "package"      },
          ] as const).map(({ key, label, icon }) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[mkt.tabBtn, tab === key && mkt.tabBtnActive]}
            >
              <Feather name={icon} size={14} color={tab === key ? "#F3F4F6" : "#6B7280"} />
              <Text style={[mkt.tabText, { color: tab === key ? "#F3F4F6" : "#6B7280" }]}>{label}</Text>
              {key === "wardrobe" && ownedSkins.length > 0 && (
                <View style={mkt.tabBadge}><Text style={mkt.tabBadgeText}>{ownedSkins.length}</Text></View>
              )}
            </Pressable>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {tab === "marketplace" ? (
            <>
              <Text style={mkt.subheading}>{marketSkins.length} skins available · Prices in π</Text>
              {marketSkins.map(skin => (
                <SkinCard key={skin.id} skin={skin}
                  onBuy={() => setBuyingId(skin.id)}
                  onEquip={() => handleEquip(skin.id)}
                  onList={() => setListingId(skin.id)}
                />
              ))}
              {marketSkins.length === 0 && (
                <View style={mkt.emptyWrap}>
                  <Feather name="shopping-bag" size={32} color="#4B5563" />
                  <Text style={mkt.emptyTitle}>You own everything!</Text>
                  <Text style={mkt.emptySub}>Check your Wardrobe to equip and manage your collection.</Text>
                </View>
              )}
            </>
          ) : (
            <>
              {ownedSkins.length === 0 ? (
                <View style={mkt.emptyWrap}>
                  <Feather name="package" size={32} color="#4B5563" />
                  <Text style={mkt.emptyTitle}>No skins yet</Text>
                  <Text style={mkt.emptySub}>Browse the Marketplace to find your first skin.</Text>
                  <Pressable onPress={() => setTab("marketplace")} style={mkt.browseCta}>
                    <Text style={mkt.browseCtaText}>Browse Marketplace</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={mkt.subheading}>
                    {ownedSkins.length} skin{ownedSkins.length === 1 ? "" : "s"} owned
                    {equippedSkin ? ` · ${equippedSkin.name} active` : ""}
                  </Text>
                  {ownedSkins.map(skin => (
                    <SkinCard key={skin.id} skin={skin}
                      onBuy={() => setBuyingId(skin.id)}
                      onEquip={() => handleEquip(skin.id)}
                      onList={() => setListingId(skin.id)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Buy Modal */}
      <Modal visible={!!buyingId} transparent animationType="slide" onRequestClose={() => setBuyingId(null)}>
        {buyingSkin && (() => {
          const cfg = TIER_CFG[buyingSkin.tier];
          return (
            <View style={modal.backdrop}>
              <View style={[modal.sheet, { borderColor: cfg.border + "60" }]}>
                <View style={modal.sheetHeader}>
                  <View style={[modal.skinIcon, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <Feather name={cfg.icon as any} size={22} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modal.skinName}>{buyingSkin.name}</Text>
                    <Text style={[modal.skinTier, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Pressable onPress={() => setBuyingId(null)} hitSlop={10}>
                    <Feather name="x" size={20} color="#6B7280" />
                  </Pressable>
                </View>

                <Text style={modal.desc}>{buyingSkin.desc}</Text>

                {buyingSkin.aura && (
                  <View style={[modal.auraBanner, { backgroundColor: cfg.color + "18", borderColor: cfg.color + "40" }]}>
                    <Feather name={cfg.icon as any} size={13} color={cfg.color} />
                    <Text style={[modal.auraText, { color: cfg.color }]}>
                      {buyingSkin.tier === "legendary" ? "✦" : "🛡️"} [Equipped Aura: {buyingSkin.aura}]
                    </Text>
                  </View>
                )}

                {buyingSkin.mintedTotal && (
                  <View style={modal.mintedRow}>
                    <Feather name="info" size={12} color="#6B7280" />
                    <Text style={modal.mintedNote}>Limited edition — only {buyingSkin.mintedTotal} minted.</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => handleBuy(buyingSkin.id)}
                  style={({ pressed }) => [modal.confirmBtn, { backgroundColor: cfg.color + "28", borderColor: cfg.color, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Feather name="shopping-bag" size={15} color={cfg.color} />
                  <Text style={[modal.confirmText, { color: cfg.color }]}>Confirm — π {buyingSkin.pricePi.toLocaleString()}</Text>
                </Pressable>
                <Pressable onPress={() => setBuyingId(null)} style={{ alignItems: "center", paddingVertical: 10 }}>
                  <Text style={modal.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* List for Sale Modal */}
      <Modal visible={!!listingId} transparent animationType="slide" onRequestClose={() => { setListingId(null); setListPrice(""); }}>
        {listingSkin && (
          <View style={modal.backdrop}>
            <View style={[modal.sheet, { borderColor: "#374151" }]}>
              <View style={[modal.sheetHeader, { borderBottomColor: "#1F2937" }]}>
                <Feather name="tag" size={20} color="#F59E0B" />
                <Text style={[modal.skinName, { flex: 1 }]}>List for Sale</Text>
                <Pressable onPress={() => { setListingId(null); setListPrice(""); }} hitSlop={10}>
                  <Feather name="x" size={20} color="#6B7280" />
                </Pressable>
              </View>
              <Text style={modal.desc}>
                Set asking price for <Text style={{ fontFamily: "Inter_700Bold", color: "#F3F4F6" }}>{listingSkin.name}</Text>.
                Marketplace takes a 2.5% fee.
              </Text>
              <View style={modal.priceInput}>
                <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>π</Text>
                <TextInput
                  value={listPrice}
                  onChangeText={setListPrice}
                  placeholder="Enter price"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  style={[modal.priceField, Platform.OS === "web" ? { outlineStyle: "none" } as any : {}]}
                />
              </View>
              <Pressable
                onPress={() => handleList(listingSkin.id)}
                style={({ pressed }) => [modal.confirmBtn, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="tag" size={15} color="#F59E0B" />
                <Text style={[modal.confirmText, { color: "#F59E0B" }]}>List for π {listPrice || "—"}</Text>
              </Pressable>
              <Pressable onPress={() => { setListingId(null); setListPrice(""); }} style={{ alignItems: "center", paddingVertical: 10 }}>
                <Text style={modal.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const mkt = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#1A1E26", backgroundColor: "#0C101A" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1A1E26", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#F3F4F6" },
  headerSub: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280", marginTop: 1 },
  valueBadge: { backgroundColor: "#F59E0B18", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#F59E0B40" },
  valueText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#F59E0B" },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, backgroundColor: "#1A1E26", borderRadius: 12, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabBtnActive: { backgroundColor: "#252A36" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge: { backgroundColor: "#F59E0B", borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#000" },
  subheading: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280", marginBottom: 12 },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#6B7280" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#4B5563", textAlign: "center" },
  browseCta: { backgroundColor: "#3B82F620", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#3B82F6", marginTop: 4 },
  browseCtaText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#60A5FA" },
});

const skins = StyleSheet.create({
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 14, position: "relative" },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  tierLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, flex: 1 },
  mintedText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  equippedBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  equippedText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  price: { fontSize: 14, fontFamily: "Inter_700Bold" },
  visualBlock: { height: 120, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarCircle: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  auraBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, marginTop: 4 },
  auraText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  info: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 },
  skinName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#F3F4F6", marginBottom: 4 },
  skinDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", lineHeight: 18 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  buyBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});

const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0E1420", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, gap: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  skinIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  skinName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#F3F4F6" },
  skinTier: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 2 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", lineHeight: 20 },
  auraBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  auraText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mintedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mintedNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1 },
  confirmText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#6B7280" },
  priceInput: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#1A1E26", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: "#374151" },
  priceField: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#F3F4F6" },
});
