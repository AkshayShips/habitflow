-- 0002: tables + indexes (RLS is enabled in 0003)
-- Every user-owned table cascades from auth.users, so deleting the auth user
-- erases all of their data (GDPR/CCPA + Apple account-deletion requirement).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text check (char_length(display_name) <= 80),
  timezone        text not null default 'UTC',
  locale          text not null default 'en',
  onboarding_goal text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create function public.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'Invalid IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function public.profiles_validate();

-- "Today" for a user in their own timezone.
create function public.user_today(uid uuid default auth.uid())
returns date
language sql
stable
set search_path = ''
as $$
  select public.local_date(
    now(),
    coalesce((select p.timezone from public.profiles p where p.id = uid), 'UTC')
  );
$$;

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
-- Client generates the UUID (offline-first), so id has no server default requirement
-- but we keep one for server-side inserts (seed, edge functions).
create table public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  icon           text not null default 'checkmark-circle',
  color          text not null default '#5B8DEF',
  category       text,
  cadence_type   text not null default 'daily'
                   check (cadence_type in ('daily', 'weekly_days', 'x_per_week', 'interval')),
  cadence_config jsonb not null default '{}'::jsonb
                   check (jsonb_typeof(cadence_config) = 'object'),
  target_value   numeric not null default 1 check (target_value > 0),
  unit           text,
  start_date     date not null default current_date,
  archived_at    timestamptz,
  sort_order     integer not null default 0,
  reminder_times jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(reminder_times) = 'array'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index habits_user_sort_idx    on public.habits (user_id, sort_order) where deleted_at is null;
create index habits_user_updated_idx on public.habits (user_id, updated_at);  -- sync pull

create trigger habits_lww
  before insert or update on public.habits
  for each row execute function public.lww_guard();

-- ---------------------------------------------------------------------------
-- habit_logs
-- ---------------------------------------------------------------------------
-- DATA MODEL ADDITIONS vs. spec: updated_at + deleted_at (needed for LWW sync / un-check).
create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,           -- the user's LOCAL calendar date, set by the client
  value      numeric not null default 1 check (value >= 0),
  status     text not null default 'done' check (status in ('done', 'skipped', 'missed')),
  note       text check (char_length(note) <= 2000),
  mood       smallint check (mood between 1 and 5),
  logged_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (habit_id, log_date)
);

create index habit_logs_user_date_idx    on public.habit_logs (user_id, log_date desc);
create index habit_logs_user_updated_idx on public.habit_logs (user_id, updated_at);  -- sync pull

create trigger habit_logs_lww
  before insert or update on public.habit_logs
  for each row execute function public.lww_guard();

-- log_date sanity: a client may log "today" or a recent past day, never the future.
-- Allows +/- 1 day around UTC "now" to cover every timezone offset (UTC-12..UTC+14).
create function public.habit_logs_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.log_date > (now() at time zone 'UTC')::date + 1 then
    raise exception 'log_date % is in the future', new.log_date using errcode = '22008';
  end if;
  return new;
end;
$$;

create trigger habit_logs_validate
  before insert or update on public.habit_logs
  for each row execute function public.habit_logs_validate();

-- ---------------------------------------------------------------------------
-- streaks + streak_freezes (server-maintained; logic arrives in Phase 2)
-- ---------------------------------------------------------------------------
create table public.streaks (
  habit_id            uuid primary key references public.habits (id) on delete cascade,
  current_streak      integer not null default 0 check (current_streak >= 0),
  longest_streak      integer not null default 0 check (longest_streak >= 0),
  last_completed_date date,
  updated_at          timestamptz not null default now()
);

create trigger streaks_updated_at
  before update on public.streaks
  for each row execute function public.set_updated_at();

create table public.streak_freezes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  used_on    date,                    -- null = banked, not yet used
  source     text not null check (source in ('earned', 'purchased')),
  created_at timestamptz not null default now()
);

create index streak_freezes_user_idx on public.streak_freezes (user_id);

-- ---------------------------------------------------------------------------
-- XP, levels, achievements
-- ---------------------------------------------------------------------------
create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  source     text not null,           -- e.g. 'habit_completed', 'streak_milestone'
  points     integer not null,
  created_at timestamptz not null default now()
);

create index xp_events_user_created_idx on public.xp_events (user_id, created_at desc);

create table public.user_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  xp         integer not null default 0 check (xp >= 0),
  level      integer not null default 1 check (level >= 1),
  life_score numeric(5, 2) not null default 0 check (life_score between 0 and 100),
  updated_at timestamptz not null default now()
);

create trigger user_progress_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  title       text not null,
  description text not null
);

create table public.user_achievements (
  user_id        uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- journal
-- ---------------------------------------------------------------------------
-- DATA MODEL ADDITIONS vs. spec: unique(user_id, entry_date), updated_at, deleted_at.
create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  body       text not null default '' check (char_length(body) <= 20000),
  mood       smallint check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, entry_date)
);

create index journal_entries_user_updated_idx on public.journal_entries (user_id, updated_at);

create trigger journal_entries_lww
  before insert or update on public.journal_entries
  for each row execute function public.lww_guard();

-- ---------------------------------------------------------------------------
-- AI coach
-- ---------------------------------------------------------------------------
create table public.ai_coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  tokens     integer,
  created_at timestamptz not null default now()
);

create index ai_coach_messages_user_created_idx on public.ai_coach_messages (user_id, created_at desc);

create table public.ai_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date    date not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- Billing cache, referrals, devices
-- ---------------------------------------------------------------------------
create table public.subscriptions_cache (
  user_id    uuid not null references auth.users (id) on delete cascade,
  entitlement text not null,          -- 'pro'
  product_id text not null,
  expires_at timestamptz,             -- null = lifetime
  store      text not null,           -- 'app_store' | 'promotional' | ...
  status     text not null,           -- 'active' | 'in_grace_period' | 'billing_retry' | 'expired' | 'refunded'
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

create trigger subscriptions_cache_updated_at
  before update on public.subscriptions_cache
  for each row execute function public.set_updated_at();

create table public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references auth.users (id) on delete cascade,
  referred_id       uuid references auth.users (id) on delete set null,
  status            text not null default 'pending' check (status in ('pending', 'completed', 'rewarded')),
  reward_granted_at timestamptz,
  created_at        timestamptz not null default now()
);

create index referrals_referrer_idx on public.referrals (referrer_id);
create index referrals_referred_idx on public.referrals (referred_id);

create table public.devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform        text not null default 'ios',
  last_seen       timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index devices_user_idx on public.devices (user_id);
