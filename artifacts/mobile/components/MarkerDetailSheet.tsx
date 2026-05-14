import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import {
  useListPitches,
  useToggleFollow,
  type Marker,
} from "@workspace/api-client-react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { getImage } from "@/lib/imageMap";
import { useUserById } from "@/lib/userCache";

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  person: "user",
  business: "briefcase",
  project: "zap",
};

function formatMoney(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n;
}

export function MarkerDetailSheet({
  visible,
  marker,
  onClose,
}: {
  visible: boolean;
  marker: Marker | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { data: pitches } = useListPitches();
  const refUser = useUserById(
    marker?.type === "person" ? marker.refId ?? null : null,
  );
  const followMut = useToggleFollow();

  const accentKey =
    marker?.type === "person"
      ? "accent"
      : marker?.type === "business"
        ? "primary"
        : "sponsor";
  const accent = (colors as any)[accentKey] as string;
  const pitch =
    marker && (marker.type === "project" || marker.type === "business")
      ? (pitches ?? []).find((p) => p.id === marker.refId)
      : null;
  const cover = pitch ? getImage(pitch.coverKey) : null;

  return (
    <Modal
      visible={visible && marker != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={30}
            tint={scheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.overlay },
            ]}
          />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 24),
              maxHeight: "85%",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {marker ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {cover ? (
                <Image
                  source={cover}
                  style={styles.cover}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.content}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: accent + "1F",
                      borderColor: accent,
                    },
                  ]}
                >
                  <Feather
                    name={ICONS[marker.type]}
                    size={11}
                    color={accent}
                  />
                  <Text style={[styles.typeText, { color: accent }]}>
                    {marker.type.toUpperCase()}
                  </Text>
                </View>

                <Text style={[styles.title, { color: colors.foreground }]}>
                  {marker.label}
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.mutedForeground }]}
                >
                  <Feather
                    name="map-pin"
                    size={11}
                    color={colors.mutedForeground}
                  />{" "}
                  {marker.city} · {marker.meta}
                </Text>

                {marker.type === "person" && refUser.id !== "unknown" ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/profile/${refUser.id}`);
                    }}
                    style={({ pressed }) => [
                      styles.personCard,
                      {
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Avatar avatarKey={refUser.avatarKey} size={56} ring />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text
                        style={[
                          styles.personName,
                          { color: colors.foreground },
                        ]}
                      >
                        {refUser.name}
                        {refUser.verified ? "  ✓" : ""}
                      </Text>
                      <Text
                        style={[
                          styles.personRole,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {refUser.title} · {refUser.company}
                      </Text>
                      <Text
                        style={[
                          styles.personBio,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={2}
                      >
                        {refUser.bio}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </Pressable>
                ) : null}

                {pitch ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/pitch/${pitch.id}`);
                    }}
                    style={({ pressed }) => [
                      styles.pitchCard,
                      {
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.pitchTitle, { color: colors.foreground }]}
                    >
                      {pitch.title}
                    </Text>
                    <Text
                      style={[
                        styles.pitchSummary,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {pitch.summary}
                    </Text>
                    <View style={styles.pitchStats}>
                      <Stat
                        label="Stage"
                        value={pitch.stage}
                        colors={colors}
                      />
                      <Stat
                        label="Raised"
                        value={`${formatMoney(pitch.raised)} / ${formatMoney(
                          pitch.raising,
                        )}`}
                        colors={colors}
                      />
                      <Stat
                        label="Backers"
                        value={String(pitch.backersCount)}
                        colors={colors}
                      />
                    </View>
                    <View style={[styles.viewProjectRow]}>
                      <Feather name="arrow-right" size={13} color={accent} />
                      <Text style={[styles.viewProjectText, { color: accent }]}>
                        View project details
                      </Text>
                    </View>
                  </Pressable>
                ) : null}

                <View style={styles.actionRow}>
                  {marker.type === "person" && refUser.id !== "unknown" ? (
                    <>
                      <Pressable
                        onPress={() =>
                          followMut.mutate({ id: refUser.id }, {})
                        }
                        style={({ pressed }) => [
                          styles.btnPrimary,
                          {
                            backgroundColor: refUser.following
                              ? colors.cardElevated
                              : colors.primary,
                            borderColor: refUser.following
                              ? colors.border
                              : colors.primary,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Feather
                          name={refUser.following ? "user-check" : "user-plus"}
                          size={14}
                          color={
                            refUser.following
                              ? colors.foreground
                              : colors.primaryForeground
                          }
                        />
                        <Text
                          style={[
                            styles.btnPrimaryText,
                            {
                              color: refUser.following
                                ? colors.foreground
                                : colors.primaryForeground,
                            },
                          ]}
                        >
                          {refUser.following ? "Following" : "Follow"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          onClose();
                          router.push(`/profile/${refUser.id}`);
                        }}
                        style={({ pressed }) => [
                          styles.btnSecondary,
                          {
                            backgroundColor: colors.cardElevated,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Feather name="user" size={14} color={colors.foreground} />
                      </Pressable>
                    </>
                  ) : pitch ? (
                    <Pressable
                      onPress={() => {
                        onClose();
                        router.push(`/pitch/${pitch.id}`);
                      }}
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        {
                          backgroundColor: accent,
                          borderColor: accent,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather name="trending-up" size={14} color="#fff" />
                      <Text style={[styles.btnPrimaryText, { color: "#fff" }]}>
                        View &amp; Invest
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.btnPrimary,
                        {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name="message-circle"
                        size={14}
                        color={colors.primaryForeground}
                      />
                      <Text
                        style={[
                          styles.btnPrimaryText,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        Get in touch
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.btnSecondary,
                      {
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="x"
                      size={14}
                      color={colors.foreground}
                    />
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
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
    overflow: "hidden",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
    zIndex: 10,
  },
  cover: {
    width: "100%",
    height: 160,
  },
  content: {
    padding: 22,
    paddingTop: 16,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  typeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
  personCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    alignItems: "center",
  },
  personName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  personRole: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  personBio: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    lineHeight: 16,
  },
  pitchCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
  },
  pitchTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  pitchSummary: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  pitchStats: {
    flexDirection: "row",
    marginTop: 14,
    gap: 16,
  },
  stat: {
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 3,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  btnSecondary: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
  },
  viewProjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
  },
  viewProjectText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
