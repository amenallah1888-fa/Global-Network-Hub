import { useListUsers } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

import { useAuth } from "@/context/AuthContext";

const fallback: User = {
  id: "unknown",
  handle: "unknown",
  name: "Unknown",
  title: "",
  company: "",
  city: "",
  country: "",
  avatarKey: "avatar1",
  verified: false,
  followersCount: 0,
  bio: "",
  following: false,
};

export function useUsers(): User[] {
  const { data } = useListUsers({
    query: { staleTime: 30_000 } as any,
  });
  return data ?? [];
}

export function useUserById(id: string | null | undefined): User {
  const users = useUsers();
  if (!id) return fallback;
  return users.find((u) => u.id === id) ?? fallback;
}

export function useCurrentUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "u_me";
}

export function useCurrentUser(): User {
  const id = useCurrentUserId();
  return useUserById(id);
}
