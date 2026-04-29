const map: Record<string, any> = {
  avatar1: require("../assets/images/avatar1.png"),
  avatar2: require("../assets/images/avatar2.png"),
  avatar3: require("../assets/images/avatar3.png"),
  post1: require("../assets/images/post1.png"),
  post2: require("../assets/images/post2.png"),
  map_bg: require("../assets/images/map_bg.png"),
};

function isUri(key: string): boolean {
  return (
    key.startsWith("data:") ||
    key.startsWith("http://") ||
    key.startsWith("https://") ||
    key.startsWith("file:") ||
    key.startsWith("blob:")
  );
}

export function getImage(key: string | null | undefined): any | undefined {
  if (!key) return undefined;
  if (isUri(key)) return { uri: key };
  return map[key];
}

export function getAvatar(key: string | null | undefined): any {
  if (key && isUri(key)) return { uri: key };
  return map[key ?? "avatar1"] ?? map.avatar1;
}

export const COVER_PRESETS = [
  { key: "post1", label: "Studio" },
  { key: "post2", label: "Workshop" },
  { key: "map_bg", label: "Atlas" },
] as const;
