export function getApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_DOMAIN;
  if (!configured) return "";

  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return withProtocol.replace(/\/+$/, "");
}