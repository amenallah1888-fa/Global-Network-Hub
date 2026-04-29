import {
  useListPosts,
  type User,
} from "@workspace/api-client-react";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Composer } from "@/components/Composer";
import { FeedSearch, FeedSearchResults } from "@/components/FeedSearch";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { SegmentControl } from "@/components/SegmentControl";
import { useColors } from "@/hooks/useColors";
import { useUsers } from "@/lib/userCache";

const TABS: { key: "foryou" | "following" | "investors" | "hiring"; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "investors", label: "Investors" },
  { key: "hiring", label: "Hiring" },
];

export default function FeedScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("foryou");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useListPosts({ feed: tab });
  const users = useUsers();

  const isSearching = search.trim().length > 0;
  const allPosts = data ?? [];

  const handlePickUser = (_u: User) => {
    setSearch("");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header title="HumanVerse" subtitle="Where operators meet capital" />
      <FlatList
        data={isSearching ? [] : allPosts}
        keyExtractor={(p) => p.id}
        refreshing={isRefetching}
        onRefresh={isSearching ? undefined : () => refetch()}
        ListHeaderComponent={
          <View>
            <FeedSearch query={search} onQueryChange={setSearch} />
            {!isSearching && (
              <>
                <View style={{ paddingTop: 12 }}>
                  <SegmentControl
                    options={TABS.map((t) => t.label)}
                    value={TABS.find((t) => t.key === tab)?.label ?? "For you"}
                    onChange={(label) =>
                      setTab(TABS.find((t) => t.label === label)?.key ?? "foryou")
                    }
                  />
                </View>
                <Composer />
              </>
            )}
            {isSearching && (
              <FeedSearchResults
                query={search}
                users={users}
                posts={allPosts}
                onPickUser={handlePickUser}
              />
            )}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
        ListFooterComponent={
          isSearching ? (
            <View>
              {(() => {
                const q = search.trim().toLowerCase();
                const tag = q.replace(/^#/, "");
                const matched = allPosts.filter((p) => {
                  const t = p.text.toLowerCase();
                  return t.includes(q) || t.includes(`#${tag}`);
                });
                return matched.map((p) => (
                  <PostCard key={p.id} post={p} />
                ));
              })()}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading && !isSearching ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    paddingVertical: 60,
    alignItems: "center",
  },
});
