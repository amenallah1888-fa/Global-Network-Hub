import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { Composer } from "@/components/Composer";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { SegmentControl } from "@/components/SegmentControl";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const TABS = ["For you", "Following", "Investors", "Hiring"];

export default function FeedScreen() {
  const colors = useColors();
  const { posts, followingIds } = useApp();
  const [tab, setTab] = useState("For you");

  const filtered = useMemo(() => {
    if (tab === "Following") {
      return posts.filter((p) => followingIds.includes(p.authorId));
    }
    if (tab === "Investors") {
      return posts.filter((p) =>
        /invest|series|fund|venture|capital|backed|raise|raising/i.test(p.text),
      );
    }
    if (tab === "Hiring") {
      return posts.filter((p) => /hir|recruit|join|role|engineer|PM|design/i.test(p.text));
    }
    return posts;
  }, [posts, followingIds, tab]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header title="Nexus" subtitle="Where operators meet capital" />
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={
          <View>
            <View style={{ paddingTop: 12 }}>
              <SegmentControl options={TABS} value={tab} onChange={setTab} />
            </View>
            <Composer />
          </View>
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
});
