import { Feather } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { Circle, getUser } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

export function CircleCard({ circle }: { circle: Circle }) {
  const colors = useColors();
  const { toggleCircleJoin } = useApp();
  const founders = circle.founderIds.map(getUser);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.coverWrap}>
        {circle.cover ? (
          <Image source={circle.cover} style={styles.cover} resizeMode="cover" />
        ) : (
          <View
            style={[
              styles.cover,
              { backgroundColor: circle.color + "30" },
            ]}
          />
        )}
        <View
          style={[
            styles.coverFade,
            { backgroundColor: colors.card },
          ]}
        />
        <View
          style={[
            styles.categoryPill,
            { backgroundColor: circle.color, borderColor: colors.card },
          ]}
        >
          <Text style={styles.categoryText}>{circle.category}</Text>
        </View>
        {circle.paid ? (
          <View
            style={[
              styles.paidPill,
              { backgroundColor: colors.background + "EE" },
            ]}
          >
            <Feather name="lock" size={10} color={colors.tip} />
            <Text style={[styles.paidText, { color: colors.tip }]}>
              ${circle.price}/mo
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {circle.name}
        </Text>
        <Text
          style={[styles.about, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {circle.about}
        </Text>

        <View style={styles.footer}>
          <View style={styles.foundersRow}>
            {founders.slice(0, 3).map((f, i) => (
              <View
                key={f.id}
                style={[
                  styles.avatarStack,
                  { marginLeft: i === 0 ? 0 : -10, borderColor: colors.card },
                ]}
              >
                <Avatar source={f.avatar} size={22} />
              </View>
            ))}
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.metaTop, { color: colors.foreground }]}>
                {circle.members.toLocaleString()}
              </Text>
              <Text style={[styles.metaBottom, { color: colors.mutedForeground }]}>
                {circle.active} active now
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => toggleCircleJoin(circle.id)}
            style={({ pressed }) => [
              styles.joinBtn,
              {
                backgroundColor: circle.joined ? colors.cardElevated : colors.primary,
                borderColor: circle.joined ? colors.border : colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.joinText,
                {
                  color: circle.joined
                    ? colors.foreground
                    : colors.primaryForeground,
                },
              ]}
            >
              {circle.joined ? "Joined" : circle.paid ? "Apply" : "Join"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 14,
  },
  coverWrap: {
    height: 110,
    position: "relative",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
    opacity: 0.5,
  },
  categoryPill: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
  },
  categoryText: {
    color: "#0A0B0F",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  paidPill: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  paidText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    padding: 16,
    paddingTop: 12,
  },
  name: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  about: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  foundersRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStack: {
    borderWidth: 2,
    borderRadius: 999,
  },
  metaTop: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  metaBottom: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  joinBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  joinText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
