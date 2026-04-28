import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Circle,
  Post,
  circles as initialCircles,
  posts as initialPosts,
  users as initialUsers,
  currentUser,
} from "@/data/mockData";

type State = {
  posts: Post[];
  circles: Circle[];
  followingIds: string[];
  composeText: string;
};

type Ctx = State & {
  toggleLike: (id: string) => void;
  toggleRetweet: (id: string) => void;
  tip: (id: string, amount: number) => void;
  composePost: (text: string) => void;
  toggleFollow: (userId: string) => void;
  toggleCircleJoin: (id: string) => void;
  setComposeText: (s: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "nexus.state.v1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [circles, setCircles] = useState<Circle[]>(initialCircles);
  const [followingIds, setFollowingIds] = useState<string[]>(
    initialUsers.filter((u) => u.following).map((u) => u.id),
  );
  const [composeText, setComposeText] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<State>;
          if (parsed.posts) {
            // re-attach images from initial dataset (require() refs aren't serializable)
            setPosts(
              parsed.posts.map((p) => {
                const fresh = initialPosts.find((q) => q.id === p.id);
                return { ...p, image: fresh?.image };
              }),
            );
          }
          if (parsed.circles) {
            setCircles(
              parsed.circles.map((c) => {
                const fresh = initialCircles.find((q) => q.id === c.id);
                return { ...c, cover: fresh?.cover };
              }),
            );
          }
          if (parsed.followingIds) setFollowingIds(parsed.followingIds);
        }
      } catch {
        // ignore
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const serializable = {
      posts: posts.map(({ image, ...rest }) => rest),
      circles: circles.map(({ cover, ...rest }) => rest),
      followingIds,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializable)).catch(
      () => {},
    );
  }, [posts, circles, followingIds, hydrated]);

  const toggleLike = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              liked: !p.liked,
              likes: p.liked ? p.likes - 1 : p.likes + 1,
            }
          : p,
      ),
    );
  }, []);

  const toggleRetweet = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              retweeted: !p.retweeted,
              retweets: p.retweeted ? p.retweets - 1 : p.retweets + 1,
            }
          : p,
      ),
    );
  }, []);

  const tip = useCallback((id: string, amount: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, tips: p.tips + amount } : p)),
    );
  }, []);

  const composePost = useCallback((text: string) => {
    if (!text.trim()) return;
    const newPost: Post = {
      id: "p_" + Date.now().toString() + Math.random().toString(36).slice(2, 7),
      authorId: currentUser.id,
      createdAt: "now",
      text: text.trim(),
      likes: 0,
      retweets: 0,
      comments: 0,
      tips: 0,
      liked: false,
      retweeted: false,
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposeText("");
  }, []);

  const toggleFollow = useCallback((userId: string) => {
    setFollowingIds((prev) =>
      prev.includes(userId)
        ? prev.filter((x) => x !== userId)
        : [...prev, userId],
    );
  }, []);

  const toggleCircleJoin = useCallback((id: string) => {
    setCircles((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              joined: !c.joined,
              members: c.joined ? c.members - 1 : c.members + 1,
            }
          : c,
      ),
    );
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      posts,
      circles,
      followingIds,
      composeText,
      toggleLike,
      toggleRetweet,
      tip,
      composePost,
      toggleFollow,
      toggleCircleJoin,
      setComposeText,
    }),
    [
      posts,
      circles,
      followingIds,
      composeText,
      toggleLike,
      toggleRetweet,
      tip,
      composePost,
      toggleFollow,
      toggleCircleJoin,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
