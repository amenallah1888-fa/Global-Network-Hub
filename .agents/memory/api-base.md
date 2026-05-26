---
name: API Base URL pattern
description: How the mobile app constructs API URLs; never use relative paths or localhost
---

## Pattern
```ts
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
// Usage:
fetch(`${API_BASE}/api/pitches/${id}`, { headers: { Authorization: `Bearer ${token}` } })
```

**Why:** The Expo app is served via Replit's proxy with mTLS; localhost doesn't resolve from the client. EXPO_PUBLIC_DOMAIN is the Replit dev domain injected at build time.
