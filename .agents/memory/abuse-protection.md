---
name: Abuse protection boundary
description: In-memory request limiting, early payload bounds, and centralized Zod sanitization for the API.
---

The API uses early per-IP in-memory limits for general traffic, authentication attempts, AI work, and proof/upload-like writes. Body parsing is bounded before route handling, and centralized Zod parsing sanitizes strings and rejects unsafe keys/control input.

**Why:** Abuse controls must run before expensive parsing or database/AI work; otherwise malformed or oversized requests can still exhaust server resources.

**How to apply:** Preserve the limiter before body parsers, keep route-specific schemas for sensitive mutations, validate decoded URL segments globally, and replace Express 5 read-only request properties with per-request definitions rather than direct query assignment. Move the limiter store to Redis before multi-instance scaling.