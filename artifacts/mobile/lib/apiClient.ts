import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBase } from "./apiBase";

let configured = false;

export function configureApiClient(): void {
  if (configured) return;
  const apiBase = getApiBase();
  if (apiBase) {
    setBaseUrl(apiBase);
  } else {
    setBaseUrl(null);
  }
  configured = true;
}
