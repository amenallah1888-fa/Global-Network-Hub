import type { User } from "@workspace/db";

export function publicUser(user: User) {
  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    title: user.title,
    company: user.company,
    city: user.city,
    country: user.country,
    avatarKey: user.avatarKey,
    verified: user.verified,
    followersCount: user.followersCount,
    bio: user.bio,
    createdAt: user.createdAt,
    isProfilePublic: user.isProfilePublic,
    role: user.role,
    reputationScore: user.reputationScore,
    kycStatus: user.kycStatus,
    locale: user.locale,
  };
}

export function currentUserView(user: User) {
  return {
    ...publicUser(user),
    kycVerifiedAt: user.kycVerifiedAt,
    piWalletAddress: user.piWalletAddress,
  };
}