# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This monorepo hosts **HumanVerse**, a high-end mobile-first social-business super app
inspired by X + LinkedIn, with persistent backend, real-time-style notifications,
an interactive world atlas, and monetization (tips and paid circles).

## Artifacts

- `artifacts/api-server` — Express API server (port 8080, mounted at `/api` on the
  shared proxy). Drizzle ORM over Replit Postgres. Auto-seeds on startup if the
  database is empty.
- `artifacts/mobile` — Expo React Native app (HumanVerse). Runs on the Expo dev
  domain. Uses generated React Query hooks from `@workspace/api-client-react`
  for all data — no local mock state.
- `artifacts/mockup-sandbox` — Vite preview surface for canvas-driven UI work
  (unused by HumanVerse production flow).

## Shared libs

- `lib/db` — Drizzle schema & client. Tables: `users`, `posts`, `likes`,
  `retweets`, `follows`, `tips`, `circles`, `circle_members`, `pitches`,
  `pitch_backers`, `markers`, `notifications`. Migrate with
  `pnpm --filter @workspace/db run push`.
- `lib/api-spec` — OpenAPI spec (`servers: /api`). Run codegen with
  `pnpm --filter @workspace/api-spec run codegen`.
- `lib/api-zod` — Generated Zod schemas. Re-exports only from
  `./generated/api` to avoid duplicate exports.
- `lib/api-client-react` — Generated React Query hooks + a customFetch with a
  module-level `setBaseUrl(...)`.

## API surface (mounted at `/api`)

- `GET /me`, `GET /users`, `POST /users/:id/follow`
- `GET /posts?feed=foryou|following|investors|hiring`, `POST /posts`,
  `POST /posts/:id/like|retweet|tip`
- `GET /circles`, `POST /circles/:id/membership`
- `GET /pitches`, `POST /pitches/:id/back`
- `GET /markers`
- `GET /notifications`, `POST /notifications/read-all`

A pseudo-auth helper in `artifacts/api-server/src/lib/currentUser.ts`
returns the fixed user id `u_me` for all requests. Notifications for actions
that target other users are written via `lib/notify.ts`.

## Mobile wiring

- `artifacts/mobile/lib/apiClient.ts` calls `setBaseUrl(https://${EXPO_PUBLIC_DOMAIN})`
  at startup. Orval already prefixes paths with `/api` from the spec's `servers`
  block, so the base URL must be the host root (no `/api`).
- `artifacts/mobile/lib/imageMap.ts` maps stable string keys
  (`avatar1..3`, `post1`, `post2`, `map_bg`) to bundled local images so the API
  doesn't serve binary assets.
- `artifacts/mobile/lib/userCache.ts` provides `useUsers`, `useUserById`, and
  `useCurrentUser` on top of the generated `useListUsers` hook.
- `Header` polls `useListNotifications` every 8s and shows an unread badge.
  Tapping the bell opens `NotificationsSheet` and marks all read after a short
  delay. The sheet renders avatars from the user cache and a colored type
  badge (like / retweet / tip / follow / circle / pitch).
- `MarkerDetailSheet` opens when a marker is tapped on Atlas. Markers store a
  `refId` pointing to either a user (`u_…`) or a pitch (`pi…`); the sheet
  hydrates the right detail card and exposes Follow / Get-in-touch CTAs.
- `Composer`, `PostCard`, `CircleCard`, `PitchCard` all use generated
  mutation hooks (`useCreatePost`, `useToggleLike`, `useToggleRetweet`,
  `useTipPost`, `useToggleCircleMembership`, `useBackPitch`) and invalidate
  the relevant query keys on success.

## TypeScript notes

- Run `pnpm -w run typecheck:libs` after schema/spec changes; run
  `pnpm --filter @workspace/mobile run typecheck` for mobile.
- The generated React Query hooks accept a `query` option typed as a full
  `UseQueryOptions` (queryKey required). Where we only want to override
  `staleTime` / `refetchInterval`, cast the partial as `any` — the codegen
  will inject the real queryKey via `getXxxQueryOptions`.

## Branding

App is consistently named **HumanVerse**. Header shows
"HumanVerse / Where operators meet capital". `app.json` display name
is "HumanVerse — Social Business Super App". The map-rendering component
is named `AtlasMap`.
