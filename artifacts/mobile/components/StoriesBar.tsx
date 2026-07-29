import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/lib/userCache";

export type StoryItem = {
  userId: string;
  name: string;
  avatarKey: string | null;
};

export const MOCK_STORIES: StoryItem[] = [
  { userId: "u_amelia", name: "Amelia", avatarKey: "avatar2" },
  { userId: "u_marcus", name: "Marcus", avatarKey: "avatar3" },
  { userId: "u_priya", name: "Priya", avatarKey: "avatar1" },
  { userId: "u_jonas", name: "Jonas", avatarKey: "avatar2" },
];

type Props = {
  onOpenViewer: (index: number) => void;
  onOpenComposer: () => void;
  viewedIds: Set<string>;
};

export function StoriesBar({ onOpenViewer, onOpenComposer, viewedIds }: Props) {
  const colors = useColors();
  const me = useCurrentUser();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[sb.container, { borderBottomColor: colors.border }]}
    >
      {/* My Story – Create */}
      <Pressable onPress={onOpenComposer} style={sb.item}>
        <View style={[sb.myRing, { borderColor: colors.border }]}>
          <Avatar avatarKey={me?.avatarKey ?? null} size={52} />
          <View style={[sb.plusDot, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Feather name="plus" size={11} color="#fff" />
          </View>
        </View>
        <Text style={[sb.label, { color: colors.foreground }]} numberOfLines={1}>Your Story</Text>
      </Pressable>

      {/* Following stories */}
      {MOCK_STORIES.map((story, idx) => {
        const isViewed = viewedIds.has(story.userId);
        return (
          <Pressable key={story.userId} onPress={() => onOpenViewer(idx)} style={sb.item}>
            {isViewed ? (
              <View style={[sb.viewedRing, { borderColor: colors.mutedForeground + "50" }]}>
                <Avatar avatarKey={story.avatarKey} size={52} />
              </View>
            ) : (
              <LinearGradient
                colors={["#B58840", "#D4AF7A", "#9D7BFF"]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={sb.gradientRing}
              >
                <View style={[sb.gradientInner, { backgroundColor: colors.background }]}>
                  <Avatar avatarKey={story.avatarKey} size={52} />
                </View>
              </LinearGradient>
            )}
            <Text style={[sb.label, { color: colors.foreground }]} numberOfLines={1}>{story.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const sb = StyleSheet.create({
  container: {
    paddingHorizontal: 12, paddingVertical: 12, gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: { alignItems: "center", gap: 6, width: 68 },
  myRing: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  plusDot: {
    position: "absolute", bottom: -1, right: -1,
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  viewedRing: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  gradientRing: {
    width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center",
  },
  gradientInner: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
});
