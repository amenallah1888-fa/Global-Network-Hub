import { useListPosts } from "@workspace/api-client-react";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Composer } from "@/components/Composer";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { SegmentControl } from "@/components/SegmentControl";
import { useColors } from "@/hooks/useColors";

const TABS: { key: "foryou" | "following" | "investors" | "hiring"; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "following", label: "Following" },
  { key: "investors", label: "Investors" },
  { key: "hiring", label: "Hiring" },
];

export default function FeedScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("foryou");

  const { data, isLoading, refetch, isRefetching } = useListPosts({ feed: tab });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header title="HumanVerse" subtitle="Where operators meet capital" />
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <View>
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
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
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
