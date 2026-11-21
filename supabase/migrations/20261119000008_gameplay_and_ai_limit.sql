-- 0008: server-side XP, levels, achievements, and the atomic AI-message counter.
-- Clients can only READ these tables (RLS). All writes happen in the security-definer functions below,
-- so a modified client cannot grant itself XP or lift the Coach limit.

-- One XP award per distinct event key (e.g. 'checkin:<habit>:<date>'), so toggling done/undone can't farm XP.
create unique index if not exists xp_events_user_source_uidx on public.xp_events (user_id, source);

-- Level n starts at 50*(n-1)^2 XP: L2=50, L3=200, L4=450, L5=800, ...
create or replace function public.level_for_xp(p_xp integer)
returns integer language sql immutable set search_path = '' as $$
  select 1 + floor(sqrt(greatest(p_xp, 0) / 50.0))::integer;
$$;

create or replace function public.unlock_achievement(p_user uuid, p_key text)
returns void language sql security definer set search_path = '' as $$
  insert into public.user_achievements (user_id, achievement_id)
  select p_user, a.id from public.achievements a where a.key = p_key
  on conflict do nothing;
$$;

create or replace function public.award_xp(p_user uuid, p_source text, p_points integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_new_xp integer;
begin
  insert into public.xp_events (user_id, source, points) values (p_user, p_source, p_points)
  on conflict (user_id, source) do nothing;
  if not found then return; end if;  -- already awarded

  insert into public.user_progress (user_id, xp, level) values (p_user, p_points, public.level_for_xp(p_points))
  on conflict (user_id) do update
    set xp = public.user_progress.xp + p_points
  returning xp into v_new_xp;

  update public.user_progress set level = public.level_for_xp(v_new_xp) where user_id = p_user;
  if public.level_for_xp(v_new_xp) >= 5 then perform public.unlock_achievement(p_user, 'level_5'); end if;
end $$;

-- A "perfect day": every habit expected on that date has a done log.
create or replace function public.is_perfect_day(p_user uuid, p_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  with due as (
    select h.id
      from public.habits h
     where h.user_id = p_user and h.deleted_at is null and h.archived_at is null
       and h.start_date <= p_date
       and public.expected_in_range(h, p_date, p_date) > 0
  )
  select exists (select 1 from due)
     and not exists (
       select 1 from due d
        where not exists (
          select 1 from public.habit_logs l
           where l.habit_id = d.id and l.log_date = p_date and l.status = 'done' and l.deleted_at is null)
     );
$$;

create or replace function public.habit_logs_xp_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and new.deleted_at is null then
    perform public.award_xp(new.user_id, 'checkin:' || new.habit_id || ':' || new.log_date, 10);
    perform public.unlock_achievement(new.user_id, 'first_checkin');
    if public.is_perfect_day(new.user_id, new.log_date) then
      perform public.award_xp(new.user_id, 'perfect_day:' || new.log_date, 25);
      perform public.unlock_achievement(new.user_id, 'perfect_day');
    end if;
  end if;
  return null;
end $$;

drop trigger if exists habit_logs_xp on public.habit_logs;
create trigger habit_logs_xp after insert or update of status, deleted_at on public.habit_logs
  for each row execute function public.habit_logs_xp_trg();

create or replace function public.habits_achv_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.unlock_achievement(new.user_id, 'first_habit');
  return null;
end $$;

drop trigger if exists habits_achv on public.habits;
create trigger habits_achv after insert on public.habits
  for each row execute function public.habits_achv_trg();

create or replace function public.streaks_achv_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select user_id into v_user from public.habits where id = new.habit_id;
  if v_user is null then return null; end if;
  if new.longest_streak >= 7   then perform public.unlock_achievement(v_user, 'streak_7');   end if;
  if new.longest_streak >= 30  then perform public.unlock_achievement(v_user, 'streak_30');  end if;
  if new.longest_streak >= 100 then perform public.unlock_achievement(v_user, 'streak_100'); end if;
  return null;
end $$;

drop trigger if exists streaks_achv on public.streaks;
create trigger streaks_achv after insert or update of longest_streak on public.streaks
  for each row execute function public.streaks_achv_trg();

create or replace function public.journal_xp_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null and char_length(btrim(new.body)) > 0 then
    perform public.award_xp(new.user_id, 'journal:' || new.entry_date, 5);
    perform public.unlock_achievement(new.user_id, 'first_journal');
  end if;
  return null;
end $$;

drop trigger if exists journal_xp on public.journal_entries;
create trigger journal_xp after insert or update of body, deleted_at on public.journal_entries
  for each row execute function public.journal_xp_trg();

-- Atomic daily counter for the AI Coach. p_limit NULL = unlimited (Pro).
-- Returns allowed + how many messages the user has used today (after this call if allowed).
create or replace function public.consume_ai_message(p_user uuid, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.user_today(p_user);
  v_count integer;
begin
  insert into public.ai_usage_daily (user_id, date, count) values (p_user, v_today, 1)
  on conflict (user_id, date) do update set count = public.ai_usage_daily.count + 1
    where p_limit is null or public.ai_usage_daily.count < p_limit
  returning count into v_count;

  if v_count is null then
    select count into v_count from public.ai_usage_daily where user_id = p_user and date = v_today;
    return query select false, coalesce(v_count, 0);
  end if;
  return query select true, v_count;
end $$;

-- Give back one message when the model call fails after we counted it.
create or replace function public.refund_ai_message(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage_daily set count = greatest(count - 1, 0)
   where user_id = p_user and date = public.user_today(p_user);
$$;

-- Server-only: nothing here may be called by app clients.
revoke all on function public.level_for_xp(integer)               from public, anon, authenticated;
revoke all on function public.unlock_achievement(uuid, text)      from public, anon, authenticated;
revoke all on function public.award_xp(uuid, text, integer)       from public, anon, authenticated;
revoke all on function public.is_perfect_day(uuid, date)          from public, anon, authenticated;
revoke all on function public.habit_logs_xp_trg()                 from public, anon, authenticated;
revoke all on function public.habits_achv_trg()                   from public, anon, authenticated;
revoke all on function public.streaks_achv_trg()                  from public, anon, authenticated;
revoke all on function public.journal_xp_trg()                    from public, anon, authenticated;
revoke all on function public.consume_ai_message(uuid, integer)   from public, anon, authenticated;
revoke all on function public.refund_ai_message(uuid)             from public, anon, authenticated;
grant execute on function public.consume_ai_message(uuid, integer) to service_role;
grant execute on function public.refund_ai_message(uuid)           to service_role;
grant execute on function public.has_pro(uuid)                     to service_role;
