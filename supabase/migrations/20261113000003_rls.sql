-- 0003: Row Level Security on EVERY table.
--
-- Principles
--   * Users-owned, client-synced data (habits, habit_logs, journal_entries, devices, profiles):
--       full CRUD limited to the owner.
--   * Server-owned data (streaks, xp, progress, achievements unlocks, AI, billing, referrals):
--       owner can SELECT only. Writes come from SECURITY DEFINER functions / Edge Functions
--       running with the service role (which bypasses RLS).
--   * `(select auth.uid())` is wrapped in a subselect so Postgres evaluates it once per
--     statement instead of once per row.
--   * Guest (anonymous) users have the `authenticated` role with an is_anonymous JWT claim,
--     so these same policies protect their data.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.habits              enable row level security;
alter table public.habit_logs          enable row level security;
alter table public.streaks             enable row level security;
alter table public.streak_freezes      enable row level security;
alter table public.xp_events           enable row level security;
alter table public.user_progress       enable row level security;
alter table public.achievements        enable row level security;
alter table public.user_achievements   enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.ai_coach_messages   enable row level security;
alter table public.ai_usage_daily      enable row level security;
alter table public.subscriptions_cache enable row level security;
alter table public.referrals           enable row level security;
alter table public.devices             enable row level security;

-- ---------------------------------------------------------------------------
-- profiles (id = auth.uid(); row is created by the signup trigger, never by the client)
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create policy habits_select_own on public.habits
  for select to authenticated using (user_id = (select auth.uid()));

create policy habits_insert_own on public.habits
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy habits_update_own on public.habits
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy habits_delete_own on public.habits
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- habit_logs (also verifies the habit belongs to the caller, so a user can't
-- attach logs to someone else's habit even with a valid habit_id)
-- ---------------------------------------------------------------------------
create policy habit_logs_select_own on public.habit_logs
  for select to authenticated using (user_id = (select auth.uid()));

create policy habit_logs_insert_own on public.habit_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits h
      where h.id = habit_id and h.user_id = (select auth.uid())
    )
  );

create policy habit_logs_update_own on public.habit_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.habits h
      where h.id = habit_id and h.user_id = (select auth.uid())
    )
  );

create policy habit_logs_delete_own on public.habit_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- streaks (no user_id column in spec -> ownership via habit). Read-only for clients.
-- ---------------------------------------------------------------------------
create policy streaks_select_own on public.streaks
  for select to authenticated
  using (exists (
    select 1 from public.habits h
    where h.id = habit_id and h.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Server-owned, owner-readable tables
-- ---------------------------------------------------------------------------
create policy streak_freezes_select_own on public.streak_freezes
  for select to authenticated using (user_id = (select auth.uid()));

create policy xp_events_select_own on public.xp_events
  for select to authenticated using (user_id = (select auth.uid()));

create policy user_progress_select_own on public.user_progress
  for select to authenticated using (user_id = (select auth.uid()));

create policy user_achievements_select_own on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));

create policy ai_usage_daily_select_own on public.ai_usage_daily
  for select to authenticated using (user_id = (select auth.uid()));

create policy subscriptions_cache_select_own on public.subscriptions_cache
  for select to authenticated using (user_id = (select auth.uid()));

create policy referrals_select_involved on public.referrals
  for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));

-- AI coach history: owner can read and clear their own chat; only the Edge Function inserts.
create policy ai_coach_messages_select_own on public.ai_coach_messages
  for select to authenticated using (user_id = (select auth.uid()));

create policy ai_coach_messages_delete_own on public.ai_coach_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catalog: achievements are readable by any signed-in user, writable by nobody (service role only)
-- ---------------------------------------------------------------------------
create policy achievements_select_all on public.achievements
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
create policy journal_select_own on public.journal_entries
  for select to authenticated using (user_id = (select auth.uid()));

create policy journal_insert_own on public.journal_entries
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy journal_update_own on public.journal_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy journal_delete_own on public.journal_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- devices (push tokens)
-- ---------------------------------------------------------------------------
create policy devices_select_own on public.devices
  for select to authenticated using (user_id = (select auth.uid()));

create policy devices_insert_own on public.devices
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy devices_update_own on public.devices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy devices_delete_own on public.devices
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Defense in depth: the anon role (not signed in at all) gets nothing.
-- Supabase grants table privileges to anon by default; RLS already blocks rows
-- (no policy targets anon), but we revoke the grants too.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
