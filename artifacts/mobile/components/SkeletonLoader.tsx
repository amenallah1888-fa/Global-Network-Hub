import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = "100%", height = 16, radius = 8, style }: SkeletonBoxProps) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function PostCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sk.header}>
        <SkeletonBox width={42} height={42} radius={21} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="60%" height={12} radius={6} />
          <SkeletonBox width="40%" height={10} radius={5} />
        </View>
      </View>
      <SkeletonBox width="100%" height={14} radius={6} style={{ marginTop: 12 }} />
      <SkeletonBox width="80%" height={14} radius={6} style={{ marginTop: 7 }} />
      <SkeletonBox width="55%" height={14} radius={6} style={{ marginTop: 7 }} />
      <View style={sk.actions}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} width={48} height={10} radius={5} />
        ))}
      </View>
    </View>
  );
}

export function PitchCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.pitchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBox width="100%" height={126} radius={12} style={{ marginBottom: 14 }} />
      <SkeletonBox width="70%" height={15} radius={7} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <SkeletonBox width={62} height={22} radius={11} />
        <SkeletonBox width={80} height={22} radius={11} />
      </View>
      <SkeletonBox width="100%" height={6} radius={3} style={{ marginTop: 14 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        <SkeletonBox width={80} height={12} radius={6} />
        <SkeletonBox width={60} height={12} radius={6} />
      </View>
    </View>
  );
}

export function StoriesBarSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.storiesRow, { borderBottomColor: colors.border }]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={sk.storyItem}>
          <SkeletonBox width={62} height={62} radius={31} />
          <SkeletonBox width={44} height={9} radius={4} style={{ marginTop: 5 }} />
        </View>
      ))}
    </View>
  );
}

export function ServiceCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[sk.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <SkeletonBox width={70} height={22} radius={11} />
        <SkeletonBox width={60} height={22} radius={11} />
      </View>
      <SkeletonBox width="75%" height={14} radius={7} />
      <SkeletonBox width="100%" height={12} radius={6} style={{ marginTop: 8 }} />
      <SkeletonBox width="85%" height={12} radius={6} style={{ marginTop: 5 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
        <SkeletonBox width={28} height={28} radius={14} />
        <SkeletonBox width="40%" height={11} radius={5} />
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  actions: { flexDirection: "row", gap: 14, marginTop: 14 },
  pitchCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 12 },
  storiesRow: {
    flexDirection: "row", gap: 16, paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storyItem: { alignItems: "center" },
  serviceCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 12 },
});
