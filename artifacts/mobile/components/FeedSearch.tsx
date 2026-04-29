import { Feather } from "@expo/vector-icons";
import type { Post, User } from "@workspace/api-client-react";
import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
};

export function FeedSearch({ query, onQueryChange }: Props) {
  const colors = useColors();
  const trimmed = query.trim();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search people, companies, #hashtags…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {trimmed.length > 0 && (
          <Pressable onPress={() => onQueryChange("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

type ResultsProps = {
  query: string;
  users: User[];
  posts: Post[];
  onPickUser: (u: User) => void;
};

const HASHTAG_RE = /#(\w+)/g;

function postHashtags(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = HASHTAG_RE.exec(text)) !== null) {
    out.push(m[1].toLowerCase());
  }
  return out;
}

function postMatchesQuery(text: string, q: string): boolean {
  const qLower = q.toLowerCase();
  const tagOnly = qLower.replace(/^#/, "");
  const inText = text.toLowerCase().includes(qLower);
  const tags = postHashtags(text);
  const inTags = tags.some(
    (t) => t === tagOnly || t.startsWith(tagOnly),
  );
  return inText || inTags;
}

export function FeedSearchResults({
  query,
  users,
  posts,
  onPickUser,
}: ResultsProps) {
  const colors = useColors();
  const q = query.trim().toLowerCase();
  const tagOnly = q.replace(/^#/, "");

  const matchedUsers = useMemo(() => {
    if (!q) return [];
    return users
      .filter((u) => {
        const hay = `${u.name} ${u.handle} ${u.title} ${u.company} ${u.city}`
          .toLowerCase();
        return hay.includes(q) || hay.includes(tagOnly);
      })
      .slice(0, 12);
  }, [users, q, tagOnly]);

  const matchedPosts = useMemo(() => {
    if (!q) return [];
    return posts.filter((p) => postMatchesQuery(p.text, q)).slice(0, 20);
  }, [posts, q]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      postHashtags(p.text).forEach((t) =>
        counts.set(t, (counts.get(t) ?? 0) + 1),
      );
    });
    return Array.from(counts.entries())
      .filter(([t, c]) => c > 0 && (q.length === 0 || t.startsWith(tagOnly)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  }, [posts, tagOnly, q]);

  if (!q) {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          TRENDING TAGS
        </Text>
        <View style={styles.tagWrap}>
          {trendingTags.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No tags yet — try posting one with #climate or #ai.
            </Text>
          ) : (
            trendingTags.map((t) => (
              <View
                key={t}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  #{t}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
      {trendingTags.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground }]}
          >
            TAGS
          </Text>
          <View style={styles.tagWrap}>
            {trendingTags.map((t) => (
              <View
                key={t}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor:
                      t === tagOnly ? colors.primary + "18" : colors.card,
                    borderColor:
                      t === tagOnly ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color:
                        t === tagOnly ? colors.primary : colors.foreground,
                    },
                  ]}
                >
                  #{t}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        PEOPLE · {matchedUsers.length}
      </Text>
      {matchedUsers.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          No people match "{query}".
        </Text>
      ) : (
        <View style={{ marginBottom: 18 }}>
          {matchedUsers.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => onPickUser(u)}
              style={({ pressed }) => [
                styles.userRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Avatar avatarKey={u.avatarKey} size={42} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[styles.userName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                  {u.verified && (
                    <Feather
                      name="check-circle"
                      size={13}
                      color={colors.primary}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.userMeta,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  @{u.handle} · {u.title}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        POSTS · {matchedPosts.length}
      </Text>
      {matchedPosts.length === 0 && (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          No posts match "{query}".
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bar: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    paddingVertical: 0,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  empty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 6,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  userName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  userMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
