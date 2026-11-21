-- 0001: shared helpers (timezone-safe dates, last-write-wins guard)

-- ---------------------------------------------------------------------------
-- Timezone helpers
-- ---------------------------------------------------------------------------

-- True if `tz` is a valid IANA timezone known to Postgres.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- The calendar date of `ts` as seen in timezone `tz`.
-- This is the ONLY way log_date should be derived server-side.
create or replace function public.local_date(ts timestamptz, tz text)
returns date
language sql
stable
set search_path = ''
as $$
  select (ts at time zone tz)::date;
$$;

-- (user_today() lives in the next migration, after public.profiles exists.)

-- ---------------------------------------------------------------------------
-- Last-write-wins guard for offline sync
-- ---------------------------------------------------------------------------
-- Clients send their own updated_at. Rules:
--   * future timestamps (> now + 5 min, i.e. clock skew) are clamped
--   * an UPDATE whose updated_at is OLDER than the stored row is silently dropped
--     (BEFORE trigger returning NULL skips the row, so upserts from stale devices are no-ops)
--   * an UPDATE that doesn't change updated_at is treated as a server-side write -> now()
create or replace function public.lww_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(coalesce(new.updated_at, now()), now() + interval '5 minutes');

  if tg_op = 'UPDATE' then
    if new.updated_at is not distinct from old.updated_at then
      new.updated_at := now();
    elsif new.updated_at < old.updated_at then
      return null; -- stale write, ignore
    end if;
  end if;

  return new;
end;
$$;

-- Plain updated_at bump for server-owned tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
