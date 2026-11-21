# HabitFlow

Phase 1: project setup, design tokens, Supabase schema + RLS, auth (Apple, magic link, guest).
Phase 2: offline-first habits (local SQLite), one-tap check-in, streaks, Today/Habits screens, completion views, Life Score, seed data.
Phase 3: sync engine (SQLite <-> Supabase, last-write-wins) and the Stats tab.

## Setup

```bash
npm install
cp .env.example .env.local        # fill in Supabase URL + anon/publishable key

# Database (Supabase CLI)
supabase init                     # once; keep the generated supabase/config.toml
supabase link --project-ref <ref>
supabase db push                  # applies supabase/migrations/*

# App (Sign in with Apple needs a dev build, not Expo Go)
npx expo prebuild --platform ios
npx expo run:ios
```

## Supabase dashboard settings required for auth

1. Authentication > Sign In / Providers: enable **Anonymous sign-ins**, **Email** (magic link), **Apple**.
2. Authentication > Sign In / Providers: enable **Manual linking** (needed to upgrade a guest to Apple).
3. Authentication > URL Configuration > Redirect URLs: add `habitflow://auth/callback`
   (and your Expo dev-client URL, e.g. `exp+habitflow://auth/callback`).
4. Apple provider: add your iOS bundle ID to "Authorized Client IDs" (native flow) and a Services ID +
   key (web flow, used only for guest -> Apple linking).
5. Turn on CAPTCHA / rate limits for anonymous sign-ins before launch.

## Layout

```
app/                 routes (Expo Router): (auth), (tabs), auth/callback
components/ui/       Text, Button, HabitIcon, OfflineBanner, Skeleton, StateViews
features/auth/       api, store, hooks, schemas
lib/                 env, supabase client, secure session storage, query client
theme/               tokens + useTheme
supabase/migrations/ SQL (helpers, tables, RLS, signup trigger)
db/seed.sql          demo data (needs demo@habitflow.app created in the dashboard first)
db/optional/         SQL NOT applied by default (server-side free-tier limit)
features/habits/     logic (dates, schedule, streak + tests), api (SQLite repository), hooks, components, schemas
lib/localDb.ts       per-user SQLite database + migrations
```

## Demo data / App Review account

1. Dashboard > Authentication > Users > Add user: `demo@habitflow.app` + a password (auto-confirm on).
2. Run `db/seed.sql` in the SQL editor. Safe to re-run; it rebuilds that user's data.

The seed fills the SERVER database. Sign in as the demo user and the Phase 3 sync pulls it onto the device.

## Streak rules

Defined once in `supabase/migrations/20261113000005_streaks.sql` and mirrored in
`features/habits/logic/streak.ts`. Change both together; both have tests.

## Live infrastructure (created Nov 2026)

- Supabase project **habitflow** (ref `zaongyuhcxvflfqxdvhg`, us-east-1). Migrations 0001-0007 are applied
  (same SQL as `supabase/migrations/`). `.env.local` holds the public URL + publishable key.
  To use the CLI later: `supabase link --project-ref zaongyuhcxvflfqxdvhg` (needs the DB password; reset it in
  Dashboard > Project Settings > Database if you don't have it).
- Vercel project **habitflow-web** (team akshay-ships): static site from `web/` (home, privacy, terms, support,
  delete-account). Production alias: https://habitflow-web-delta.vercel.app
  Redeploy: `cd web && npx vercel deploy --prod`.
- Pages are DRAFTS with `[your support email]` / `[your jurisdiction]` placeholders. Fix before App Store submission.

## Dashboard steps that can't be done from code

1. Authentication > Sign In / Providers: enable Anonymous, Email, Apple (+ Manual linking).
2. Authentication > URL Configuration: Site URL `https://habitflow-web-delta.vercel.app`; add Redirect URL
   `habitflow://auth/callback` (and your dev-client scheme).
3. Enable CAPTCHA / rate limits for anonymous sign-ins before launch.

## Sync (Phase 3)

```
features/sync/   syncEngine (pure), api/sqliteLocalStore, api/supabaseRemote, syncManager, hooks/useSyncLifecycle, testing/harness
features/stats/  logic/stats (pure + tests), components (SegmentedControl, BarChart, Heatmap)
```

- Local SQLite is the source of truth. Every mutation marks the row `dirty` and schedules a sync (debounced 1.5s).
  Syncs also run on app foreground and when the network returns. Profile > "Sync now" forces one.
- Order: push habits, push logs, pull habits, pull logs. Pull uses a keyset cursor on (updated_at, id).
- Conflicts: last-write-wins on `updated_at`. The server trigger `lww_guard` ignores stale updates and clamps
  timestamps more than 5 minutes in the future. A dirty local row at least as new as the remote row wins.
- Logs are identified by (habit_id, log_date); two devices logging the same day converge to one row.
- Rows the server rejects permanently stay dirty and are skipped (shown as "couldn't be saved" in Profile).
  Network and 5xx errors abort the pass and retry later.
- Stats mirror the server views. Free plan: 7-day history (Month/Year and older heatmap cells are locked).
  `useIsPro()` is still a stub returning false until RevenueCat lands.

Tests: `npx jest` (48 tests: streaks, auth schemas, sync engine against real SQLite + a fake server, stats).

## UI pass (all screens)

Screens for features whose backend is not built yet are UI-only and marked `UI PREVIEW` at the top of the file.
Mock data lives in `features/preview/mock.ts`; placeholder prices in `lib/pricing.ts` (NOT real prices).

| Screen | Route | Status |
|---|---|---|
| Today (progress card, XP strip) | `(tabs)/index` | real data; XP is mock |
| Habits / Habit detail | `(tabs)/habits`, `habit-detail` | real data |
| Stats + ad placeholder | `(tabs)/stats` | real data; ad is a placeholder |
| Coach | `(tabs)/coach` | canned replies, local 3/day counter |
| Profile (menu, upgrade, sync) | `(tabs)/profile` | real |
| Journal | `journal` | local state only |
| Achievements + XP | `achievements` | mock |
| Paywall | `paywall` | no purchase; placeholder prices |
| Onboarding | `onboarding` | not saved; opened from Profile |
| Settings, Reminders, Export, Delete account | `settings/*` | local state only |
