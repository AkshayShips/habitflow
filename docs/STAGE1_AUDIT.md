# HabitFlow – Stage 1 Audit (no code changed in this stage)

Status labels used everywhere: **IT** Implemented and tested · **INT** Implemented but not fully tested · **UI** UI-only · **PLAN** Planned · **BLK** Blocked by external configuration.

Honesty note: all visual checks so far were done in a desktop Chromium rendering of the web build. No iOS simulator or device has been used. Sync has never run from the app against the live Supabase project.

## 1. Architecture summary

- **Client:** Expo SDK 58 / RN 0.88 / React 19.3 / TypeScript strict, Expo Router (`app/`), React Query (server/local cache), Zustand (auth + sync stores).
- **Source of truth:** local SQLite per user (`habitflow-<userId>.db`, `PRAGMA user_version` migrations in `lib/localMigrations.ts`). Local tables: `habits`, `habit_logs`, `sync_state`.
- **Sync (`features/sync/`):** push habits → push logs → pull habits → pull logs; keyset cursor on `(updated_at, id)`; last-writer-wins; rejected rows stay dirty; single-flight manager, 1.5 s debounce, foreground/network triggers. Covered by 14 engine tests with an in-memory harness. **This must not change.**
- **Backend (Supabase, live):** Postgres + RLS (`(select auth.uid())`), `lww_guard`, streak recompute, life-score views, server-side XP/levels/8 achievements (triggers, migration 0008), atomic AI counter (`consume_ai_message`), `has_pro()`; Edge Functions `coach`, `delete-account`, `revenuecat-webhook`.
- **Auth:** PKCE magic link, anonymous guest, guest→account linking, Keychain-chunked session storage; Apple sign-in code present.
- **Web preview:** `EXPO_PUBLIC_DEMO=1` swaps in an in-memory DB with seeded data and a fake session. Auto-deployed from `main` to Vercel (`habitflow-preview`).
- **Design layer today:** `theme/tokens.ts` (iOS-system-like blue palette), `components/ui/*` (Button, Card/Group/ListRow, ProgressRing, LargeHeader, Screen, Text, Skeleton, StateViews).

## 2. Screen inventory

| Route | Purpose | Data | Status |
|---|---|---|---|
| `(auth)/sign-in` | magic link / guest / Apple | real auth | INT (never run on device; Apple BLK) |
| `auth/callback` | magic-link return | real | INT |
| `(tabs)/index` Today | check-ins, ring | real SQLite | IT (logic) / INT (UI) |
| `(tabs)/habits` | list/archive | real | INT |
| `habit/new`, `habit/[id]` (edit), `habit-detail` | create/edit/detail | real | INT |
| `(tabs)/stats` | week/month stats, heatmap | real, tested logic | IT (logic) / INT (UI) |
| `(tabs)/coach` | chat | **canned replies** | UI |
| `(tabs)/profile` | account/menu | partial (auth) | INT |
| `journal` | entries | **local React state + mock** | UI |
| `achievements` | list | **mock** | UI |
| `paywall` | plans | **placeholder prices**, CTA disabled | UI / BLK |
| `onboarding` | intro | choices not saved | UI |
| `settings/index`, `reminders`, `export`, `delete-account` | settings | toggles are local state; export/delete not wired | UI (delete Edge Function exists, untested from app) |

## 3. UI PREVIEW screens, mock data, placeholder pricing (complete list)

- Files tagged `UI PREVIEW`: `paywall.tsx`, `journal.tsx`, `achievements.tsx`, `onboarding.tsx`, `(tabs)/coach.tsx`, `settings/{index,reminders,export,delete-account}.tsx`.
- Mock data: `features/preview/mock.ts` – `MOCK_XP` (also used by the Today XP link), `MOCK_ACHIEVEMENTS` (keys do **not** match the 8 server keys), `MOCK_JOURNAL`, `COACH_*`.
- Placeholder pricing: `lib/pricing.ts` (`$—`, no real amounts; real prices must come from RevenueCat offerings).
- Stub: `lib/entitlements.ts` `useIsPro()` always false.
- `components/ui/AdBanner.tsx` is a placeholder, not AdMob.
- Not real: demo seed data (`lib/demoSeed.ts`) and the fake demo session.

## 4. Design inconsistencies

1. Hard-coded hex colors outside tokens (`settings/*`, `profile`, `stats` Tile tones, `_layout` PhoneFrame, `habit-detail`, `habits`). Need semantic tint tokens.
2. Palette differs from the spec (current accent `#2F5FD0` blue, bg `#F2F2F7`; spec: `#6558F5`, `#F8F9FC`). Spacing scale is 4/8/16/24/32/48; spec adds 12/20/40. Radii 8/12/16/24; spec 10/16/22/28.
3. Two overlapping detail/edit screens: `habit-detail` (read-only, reached from nowhere except its own file's registration – Habits list pushes to `/habit/[id]` edit). Detail screen appears unreachable; verify and merge.
4. `HabitForm`, `sign-in`, `delete-account`, `habit/[id]` still use the older (pre-restyle) look in places; not audited visually.
5. No shared sheet/modal, swipe action, toast, or empty-state illustration components.
6. Web-only workarounds in the tab bar (height/padding) should be isolated, not mixed into native styling.

## 5. Technical debt

- No animation library installed (`react-native-reanimated` missing; `gesture-handler` present but unused). Press/scale animations use core `Animated`. No Reduce Motion handling.
- Dynamic Type: `Text` variants use fixed sizes; `allowFontScaling` limits not set. Layouts not verified at large sizes.
- Icons are Ionicons (not SF Symbols); acceptable, but `expo-symbols` is an option for iOS-native feel.
- `features/preview/mock.ts` imported by production routes (Today).
- Reminders/notifications: `expo-notifications` not installed. Export: no `expo-file-system`/`expo-sharing`.
- Journal/XP/achievements have server tables but **no local tables and no sync entities**; adding journal sync means extending the (tested) engine, which is the largest risk.
- Tests only cover logic (48 tests, 4 suites). No component, e2e, or device tests.
- `AGENTS.md` says `src/app/`; the project uses `app/`.
- GitHub repo is public (contains no secrets: `.env.local` is ignored; only the publishable Supabase key is in `vercel.json`).

## 6. Existing feature status

| Feature | Label |
|---|---|
| Local habit CRUD, schedules, check-ins, streaks | IT (logic) |
| Stats (completion, perfect days, heatmap) | IT (logic) |
| Sync engine | IT (engine, in-memory harness); never run vs live DB from app |
| Auth (magic link, guest, link) | INT |
| Apple sign-in | BLK (Apple developer config) |
| Server XP/achievements/AI limit | Tested via SQL rollback test; client not connected → INT |
| Edge Functions `delete-account`, `revenuecat-webhook` | INT (deployed, not called from app / RevenueCat) |
| Edge Function `coach` | INT; BLK until `ANTHROPIC_API_KEY` secret is set |
| Journal, achievements, onboarding, reminders, settings, coach UI, paywall | UI |
| RevenueCat purchases | BLK (account, products, API key) |
| AdMob / ATT | PLAN / BLK |
| PostHog, Sentry | PLAN |
| Widgets, HealthKit, Watch, Shortcuts | PLAN (require native targets / dev build; cannot be verified here) |
| Adaptive Momentum | PLAN (see §8) |

## 7. Missing dependencies

`react-native-reanimated` (+ worklets as required by SDK 58 – check docs), `@gorhom/bottom-sheet` or Expo Router sheet presentation (prefer native sheet first), `expo-notifications`, `expo-file-system` + `expo-sharing`, `expo-symbols` (optional), `react-native-purchases` (+ UI), `expo-device`/dev-client build, later: `@bacons/apple-targets` or similar for widgets, `react-native-health`/HealthKit config plugin. All versions must come from `node_modules/expo/bundledNativeModules.json`; `expo install` fails in this sandbox. Native modules do not run in the web preview, so they need guarded fallbacks.

## 8. Migration risks

- **Palette/token swap:** low risk if components consume tokens; the hex leaks (§4.1) must be fixed first or they will look wrong.
- **Adaptive Momentum:** needs a data-model decision (derived-only from existing logs vs. new tables like per-habit difficulty / momentum snapshots). Derived-only needs **no schema change** and is my recommended start. New columns affect sync + RLS → ask first.
- **Journal sync:** adding an entity to the sync engine touches tested code; add as a separate entity with its own tests, don't edit habit/log paths.
- **Coach privacy:** sending habit data to Claude changes privacy behaviour → requires explicit opt-in and your approval; today only the conversation is sent.
- **Reanimated on web preview/Vercel:** must verify `expo export -p web` still builds.
- **Pro limits:** client gating is cosmetic; server already enforces AI limit. Habit-count limit exists only in an optional SQL file (`db/optional/free_tier_limit.sql`), not applied.
- **Deleting tests:** none will be deleted.

## 9. Proposed implementation order (dependency-aware)

1. **Stage 2 – Design system:** new tokens (spec palette, spacing, radii, semantic tints), remove hex leaks, Text/Button/Card/ListRow/Sheet/Toast/EmptyState, Reduce Motion + Dynamic Type helpers, reanimated install. Preview on Vercel.
2. **Stage 3 – Core screens:** Today, Habits, Habit detail (merge duplicate), Stats, Profile, using only real data.
3. **Stage 4 – Adaptive Momentum:** pure TS logic + unit tests first (derived from logs); UI after; schema change only if you approve.
4. **Stage 5 – Replace previews:** achievements (read server tables, real keys) → journal (local table + sync entity + tests) → settings/reminders/export/delete → onboarding (persist) → coach (live after `ANTHROPIC_API_KEY`; consent screen).
5. **Stage 6 – RevenueCat:** entitlement hook, paywall from offerings; BLK on account/products.
6. **Stage 7 – Native integrations:** widgets, HealthKit, Watch, Shortcuts – each labelled PLAN/BLK until built on a device with a dev build.
7. **Stage 8 – Hardening:** a11y pass, tests, error/empty states, perf, privacy review.

## 10. Decisions needed from you before the affected stage

1. Adaptive Momentum: derived-only (recommended) or new tables/fields?
2. Coach: conversation-only (current) or opt-in habit context?
3. Accept the spec's purple palette replacing the current blue?
4. Real Pro prices (I will not invent them) – or keep prices coming only from RevenueCat offerings.
