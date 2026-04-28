const map: Record<string, any> = {
  avatar1: require("../assets/images/avatar1.png"),
  avatar2: require("../assets/images/avatar2.png"),
  avatar3: require("../assets/images/avatar3.png"),
  post1: require("../assets/images/post1.png"),
  post2: require("../assets/images/post2.png"),
  map_bg: require("../assets/images/map_bg.png"),
};

export function getImage(key: string | null | undefined): any | undefined {
  if (!key) return undefined;
  return map[key];
}

export function getAvatar(key: string | null | undefined): any {
  return map[key ?? "avatar1"] ?? map.avatar1;
}
