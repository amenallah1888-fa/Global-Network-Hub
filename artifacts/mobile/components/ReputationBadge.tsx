import { Text, View } from "react-native";

const BADGE_TIERS = [
  { min: 0,   max: 9,        label: "Newcomer",  emoji: "🌱", color: "#6B7280" },
  { min: 10,  max: 24,       label: "Builder",   emoji: "⭐", color: "#3B82F6" },
  { min: 25,  max: 49,       label: "Trusted",   emoji: "🌟", color: "#22C55E" },
  { min: 50,  max: 84,       label: "Expert",    emoji: "🏆", color: "#F59E0B" },
  { min: 85,  max: 99,       label: "Validator", emoji: "🛡️", color: "#8B5CF6" },
  { min: 100, max: Infinity, label: "Legend",    emoji: "💎", color: "#EC4899" },
];

type Props = {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

export function ReputationBadge({ score, size = "md", showLabel = false }: Props) {
  const tier = BADGE_TIERS.find(t => score >= t.min && score <= t.max) ?? BADGE_TIERS[0];
  const isLg = size === "lg";
  const isSm = size === "sm";
  const fs = isLg ? 16 : isSm ? 10 : 12;
  const px = isLg ? 12 : isSm ? 6 : 8;
  const py = isLg ? 6 : isSm ? 2 : 4;

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: tier.color + "18",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tier.color + "50",
      paddingHorizontal: px,
      paddingVertical: py,
    }}>
      <Text style={{ fontSize: fs }}>{tier.emoji}</Text>
      <Text style={{ fontSize: fs, fontFamily: "Inter_700Bold", color: tier.color }}>{score}</Text>
      {showLabel && (
        <Text style={{ fontSize: fs - 1, fontFamily: "Inter_500Medium", color: tier.color }}>
          {tier.label}
        </Text>
      )}
    </View>
  );
}

export function getTierForScore(score: number) {
  return BADGE_TIERS.find(t => score >= t.min && score <= t.max) ?? BADGE_TIERS[0];
}

export function getLevelFromScore(score: number): number {
  if (score >= 100) return 5;
  if (score >= 50)  return 4;
  if (score >= 25)  return 3;
  if (score >= 10)  return 2;
  return 1;
}
