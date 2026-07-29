import {
  useListPosts,
  type User,
} from "@workspace/api-client-react";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Composer } from "@/components/Composer";
import { FeedSearch, FeedSearchResults } from "@/components/FeedSearch";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { SegmentControl } from "@/components/SegmentControl";
import { StoriesBar, MOCK_STORIES } from "@/components/StoriesBar";
import { StoryViewer } from "@/components/StoryViewer";
import { StoryReelComposerSheet } from "@/components/StoryReelComposerSheet";
import { PostCardSkeleton, StoriesBarSkeleton } from "@/components/SkeletonLoader";
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
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyStartIndex, setStoryStartIndex] = useState(0);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useListPosts({ feed: tab });
  const users = useUsers();

  const isSearching = search.trim().length > 0;
  const allPosts = data ?? [];

  const handlePickUser = (_u: User) => setSearch("");

  const openStoryViewer = (index: number) => {
    setStoryStartIndex(index);
    setStoryViewerOpen(true);
  };

  const markStoryViewed = (userId: string) =>
    setViewedStoryIds((v) => new Set([...v, userId]));

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
            {/* Stories bar — hidden while searching */}
            {!isSearching && (
              isLoading ? (
                <StoriesBarSkeleton />
              ) : (
                <StoriesBar
                  onOpenViewer={openStoryViewer}
                  onOpenComposer={() => setComposerOpen(true)}
                  viewedIds={viewedStoryIds}
                />
              )
            )}

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
                return matched.map((p) => <PostCard key={p.id} post={p} />);
              })()}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading && !isSearching ? (
            <View>
              {[0, 1, 2, 3].map((i) => (
                <PostCardSkeleton key={i} />
              ))}
            </View>
          ) : !isLoading && !isSearching && allPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="rss" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing here yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {tab === "following"
                  ? "Follow people to see their posts here."
                  : "Be the first to post something."}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Story viewer */}
      <StoryViewer
        visible={storyViewerOpen}
        stories={MOCK_STORIES}
        startIndex={storyStartIndex}
        onClose={() => setStoryViewerOpen(false)}
        onViewed={markStoryViewed}
      />

      {/* Story/Reel composer */}
      <StoryReelComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyState: {
    alignItems: "center", paddingVertical: 56, paddingHorizontal: 32, gap: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
