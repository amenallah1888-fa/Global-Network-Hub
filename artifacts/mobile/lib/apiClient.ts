import { setBaseUrl } from "@workspace/api-client-react";

let configured = false;

export function configureApiClient(): void {
  if (configured) return;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    setBaseUrl(`https://${domain}`);
  } else {
    setBaseUrl(null);
  }
  configured = true;
}
