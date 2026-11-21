-- OPTIONAL — not applied by default.
-- Server-side enforcement of the free tier's 5 active habits.
--
-- DO NOT enable this until the RevenueCat webhook -> subscriptions_cache sync exists (Phase on
-- subscriptions). Until then has_pro() is false for everyone, so paying users would be blocked,
-- and a free user who created a 6th habit offline would have it rejected on sync.
--
-- To enable: copy into a new migration file.

create or replace function public.enforce_free_habit_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  if new.deleted_at is not null or new.archived_at is not null then
    return new;
  end if;

  select count(*) into active_count
    from public.habits
   where user_id = new.user_id and deleted_at is null and archived_at is null and id <> new.id;

  if active_count >= 5 and not public.has_pro(new.user_id) then
    raise exception 'Free plan is limited to 5 active habits' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger habits_free_limit
  before insert or update of archived_at, deleted_at on public.habits
  for each row execute function public.enforce_free_habit_limit();

revoke all on function public.enforce_free_habit_limit() from public, anon, authenticated;
