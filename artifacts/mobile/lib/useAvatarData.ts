import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export type AvatarData = {
  level: number;
  xp: number;
  nextLevelXp: number;
  xpToNextLevel: number;
  activeSkinUrl: string | null;
  activeSkin: { name: string; tier: string } | null;
  dailyStreak: number;
  path: string | null;
  decayActive: boolean;
  mintStatus: string;
};

export function useAvatarData(userId: string | null | undefined) {
  const { token } = useAuth();
  return useQuery<AvatarData>({
    queryKey: [`/api/users/${userId}/avatar`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/users/${userId}/avatar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("avatar-not-found");
      return res.json();
    },
    enabled: !!userId && !!token,
    staleTime: 60_000,
    retry: false,
  });
}

export const TIER_COLOR: Record<string, string> = {
  common: "#94A3B8",
  uncommon: "#22C55E",
  rare: "#3B82F6",
  epic: "#8B5CF6",
  legendary: "#F59E0B",
};
