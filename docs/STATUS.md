# HabitFlow: honest status (2026-11-25)

Labels: **IT** Implemented and tested · **INT** Implemented but not fully tested · **UI** UI-only · **PLAN** Planned · **BLK** Blocked by external configuration.

"Tested" here means automated tests (138 tests, 15 suites: logic, sync engine against a fake server, real SQLite via node:sqlite) and/or rolled-back SQL tests against the live Supabase project. **Nothing has been run on an iOS device or simulator.** Visual checks were desktop Chromium screenshots of the web build only. The app has not been submitted to or approved by the App Store.

## Features

| Area | Status | Notes |
|---|---|---|
| Local habits, schedules, check-ins, streaks | IT (logic) / INT (UI) | SQLite per user, migrations v1-v4 |
| Stats (completion, perfect days, heatmap) | IT (logic) / INT (UI) | Free = 7 days is a UI limit |
| Sync (habits, check-ins, effort levels, experiments, journal) | IT against a fake server | Never run from the app against live Supabase |
| Adaptive Momentum (insights, suggestions, recovery, effort levels, experiments) | IT (logic, sync) / INT (UI) | Deterministic and explainable, never causal. Insights are free for everyone (assumption) |
| Achievements and XP | IT (server SQL) / INT (client) | Awarded by DB triggers; client only reads |
| Journal | IT (sync tests, SQL) / INT (UI) | Stored as plain text on the server, protected by RLS, no extra encryption |
| Export (JSON) | IT (content) / INT (share) | Share sheet not run on a device |
| Delete account | IT (logic, mocks) / INT | Never run against the live function from the app |
| Reminders | IT (logic) / INT | Local notifications, never scheduled on a device |
| Onboarding | IT (planning logic) / INT | First-run trigger and permission prompt not seen on a device |
| Auth: guest, magic link | INT | Guest sign-in was used on the live web test after anonymous sign-ins were enabled |
| Auth: Sign in with Apple | BLK | Needs Apple Developer configuration |
| AI Coach | INT / BLK | Client and server work as far as Anthropic's API; **blocked on Anthropic API credits** (log: "credit balance is too low"). No real reply has been seen |
| Pro entitlement and paywall | IT (logic, fake driver) / BLK | Needs RevenueCat account, App Store products, `pro` entitlement, iOS key, webhook secret. No prices exist in the app |
| Terms / Privacy links | BLK | Legal pages are drafts with placeholders; dead links were removed |
| Ads (AdMob, ATT) | PLAN | `AdBanner` is a placeholder |
| PostHog, Sentry | PLAN | Not integrated |
| Widgets, HealthKit, Watch, Shortcuts | PLAN | Need a development build and real devices |
| Check-in by effort level, pause state, skip control | PLAN | Not built |
| Swipe actions, bottom sheets | PLAN | Need Reanimated, not installed |

## Backend (Supabase `zaongyuhcxvflfqxdvhg`)

- RLS on every table; ownership tests run as rolled-back SQL blocks. Security advisor findings (reviewed 2026-11-25):
  - `refresh_life_score()` callable by signed-in users: intentional, derives only the caller's data.
  - "Anonymous access policies" on user tables: expected now that guest sign-in is on. Every one is an own-rows policy (`*_own`); `achievements_select_all` is the public catalogue.
  - Leaked-password protection off: dashboard setting, not relevant while sign-in is magic link / guest only.
- Edge Functions: `coach` (needs `ANTHROPIC_API_KEY` and credits), `delete-account`, `revenuecat-webhook` (needs `REVENUECAT_WEBHOOK_SECRET`).
- Performance advisor: added an index for `user_achievements.achievement_id`. Unused-index notices are expected on a new database.

## Before a public launch (your decisions or accounts)

1. Anthropic API credits (Coach). Monthly spend limit in the Anthropic console.
2. Turn on CAPTCHA / attack protection: anonymous sign-ins let anyone create accounts with one click.
3. RevenueCat, App Store products, Apple Developer account, bundle ID.
4. Real Terms and Privacy pages with working links; Apple privacy "nutrition label" answers.
5. Auth dashboard: providers, redirect URLs (magic link), email templates.
6. Decide whether the journal needs extra encryption, and whether insights stay free.
7. Make the GitHub repo private. The `live-test` branch and its Vercel preview are public: delete them when finished.
8. A development build on a real iPhone: reminders, export sharing, delete account, sync against live Supabase, purchases.
9. Accessibility on a device: VoiceOver and Dynamic Type at the largest sizes (text is capped at 1.6x; larger sizes unchecked).
