# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This monorepo hosts **HumanVerse**, a high-end mobile-first social-business super app
inspired by X + LinkedIn, with persistent backend, real-time-style notifications,
an interactive world atlas, and monetization (tips and paid circles).

## Running on Replit

- Install the workspace dependencies required by the running services with
  `pnpm install --filter @workspace/api-server... --filter @workspace/mobile...`.
- Push the development database schema with
  `pnpm --filter @workspace/db run push`.
- The managed workflow `artifacts/api-server: API Server` runs the Express API on
  port 8080.
- The managed workflow `artifacts/mobile: expo` runs the Expo web preview on the
  Expo development domain.

## Artifacts

- `artifacts/api-server` — Express API server (port 8080, mounted at `/api` on the
  shared proxy). Drizzle ORM over Replit Postgres. On startup it ensures platform
  settings and the secret-backed `super_admin` bootstrap account exist, then seeds
  demo data only when the user table is empty.
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
- `GET /pitches`, `POST /pitches`, `POST /pitches/:id/back`
- `GET /markers`
- `GET /notifications`, `POST /notifications/read-all`
- Admin operations are under `/admin` and require the server-side `admin` or
  `super_admin` role: revenue analytics, escrow resolution, user access/KYC
  controls, audit logs, and platform fee settings.

### Monetization administration

- `platform_settings` stores live fee configuration.
- `fee_transactions` is the append-only platform fee ledger used by revenue
  analytics.
- Existing `audit_logs` consumers remain compatible; new nullable `user_id`,
  sanitized `ip_address`, and JSON `details` fields support admin visibility.
- Escrow release/refund locks the agreement and settings rows and writes the
  agreement state, fee ledger, transaction, and audit event in one database
  transaction. Notifications are sent only after commit.
- The mobile `/admin` screen is a monetization console with an explicit 403
  state for non-admin roles. It uses authenticated API requests and contains no
  mock financial data.

A pseudo-auth helper in `artifacts/api-server/src/lib/currentUser.ts`
returns the fixed user id `u_me` for all requests. Notifications for actions
that target other users are written via `lib/notify.ts`.

## Mobile wiring

- `artifacts/mobile/lib/apiClient.ts` calls `setBaseUrl(https://${EXPO_PUBLIC_DOMAIN})`
  at startup. Orval already prefixes paths with `/api` from the spec's `servers`
  block, so the base URL must be the host root (no `/api`).
- `artifacts/mobile/lib/imageMap.ts` maps stable string keys
  (`avatar1..3`, `post1`, `post2`, `map_bg`) to bundled local images so the API
  doesn't serve binary assets. Keys that start with `data:`, `http(s):`,
  `file:`, or `blob:` are returned as `{ uri }` instead, which lets users upload
  custom pitch covers (stored as base64 data URLs in the `coverKey` column).
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
- `FeedSearch` (sticky search bar at the top of the Feed) and `FeedSearchResults`
  (renders below it when the query is non-empty) provide a single-pane search
  over both posts and people. Posts are matched on substring of `text`, with
  hashtag awareness (`#climate`, `climate`, etc.). People are matched on
  `name`, `handle`, `title`, `company`, and `city`. A "Trending Tags" pill row
  shows top hashtags computed from all loaded posts.
- `HubFiltersSheet` is a multi-select filter sheet on the Investment Hub.
  Filters are tracked in screen state (`HubFilters`) and applied client-side:
  multi-select Industry, single-select Funding band (`<$500K`, `$500K–$2M`,
  `$2M–$10M`, `>$10M`, `any`), and multi-select Location. The Hub header's
  filter icon opens it, an active-filter chip appears below the segment
  control showing the count and a "Clear" action, and the empty state copy
  changes to reflect filter-vs-no-data.
- **Direct messaging.** A `messages` table (Postgres, `lib/db/src/schema/messages.ts`)
  stores `fromUserId`, `toUserId`, `text`, `read`, `createdAt`, with indexes on
  the from/to ids and on the (from, to) pair for fast thread lookups.
  - API endpoints (`artifacts/api-server/src/routes/messages.ts`):
    - `GET /conversations` returns one entry per peer with the latest message
      and an `unread` count, with the peer's full `User` payload inlined.
    - `GET /conversations/:userId/messages` returns the full thread between
      the current user and `:userId`, and marks inbound messages as read.
    - `POST /conversations/:userId/messages` inserts a new message and creates
      a `message`-type notification for the recipient.
  - Mobile screens:
    - `app/inbox.tsx` — Messages inbox (per-thread row with avatar, name,
      preview, timestamp, and a primary-colored unread badge). Polls every 8s.
    - `app/chat/[userId].tsx` — chat thread with day separators, asymmetric
      message bubbles (mine = primary background, theirs = card with border),
      a multiline composer, and `KeyboardAvoidingView`. Polls every 6s and
      auto-scrolls to the latest message.
    - "Contact" buttons appear on every `PitchCard` (when the founder is not
      the current user) and on each Profile suggested-row (small icon-only
      button next to Follow). The Profile "Quick actions" grid replaces the
      old Invites tile with a Messages tile that routes to `/inbox`.
- `PitchComposerSheet` is a modal sheet on the Investment Hub screen for
  creating new pitches. Uses `expo-image-picker` for cover upload (with three
  preset thumbnails as fallback), chip pickers for Stage / Industry / City,
  and `useCreatePitch`. On success it invalidates both the pitches query and
  the markers query so the new pitch shows up instantly in the Hub list and
  on the AtlasMap. The server endpoint also creates a `markers` row whose
  `refId` points to the new pitch, so tapping the marker opens the same
  detail sheet used for seeded pitches.

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
