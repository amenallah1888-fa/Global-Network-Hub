---
name: New screens registered in _layout.tsx
description: Which screens exist and how to navigate to them
---

## Screens Added
- `/my-campaigns` — Creator dashboard; shows founder's own pitches with expanded milestone cards and proof submission
- `/admin` — Validator Panel; shows pending documents + projects, approve/reject actions

## Navigation
Both screens are reachable from the Profile tab Quick Actions grid (profile.tsx).
Both are registered in `app/_layout.tsx` with `animation: "slide_from_right"`.

**Why:** Expo Router file-based routing requires every screen to be registered in the Stack in _layout.tsx.
