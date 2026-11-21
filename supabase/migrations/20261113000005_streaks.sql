-- 0005: server-side streak maintenance.
--
-- Streak units by cadence (the client implements the SAME rules in
-- features/habits/logic/streak.ts; keep them in sync, both have tests):
--   daily / weekly_days : consecutive SCHEDULED days. A day counts if 'done'. 'skipped' days and
--                         days covered by a streak freeze neither add nor break. Today being
--                         not-yet-done never breaks the streak (the day isn't over).
--                         weekly_days config: {"days":[1,3,5]}  (0 = Sunday ... 6 = Saturday)
--   x_per_week          : consecutive WEEKS (Monday start) with >= times completions.
--                         config: {"times":3}. The current, unfinished week never breaks it.
--   interval            : consecutive completions where the gap to the previous completion is
--                         <= every_days. config: {"every_days":2}. Streak is 0 once today is more
--                         than every_days after the last completion.

create or replace function public.recompute_streak(p_habit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h          public.habits;
  today      date;
  from_date  date;
  d          date;
  w          date;
  prev       date;
  run        integer := 0;
  longest    integer := 0;
  last_done  date;
  cnt        integer;
  target     integer;
  gap        integer;
begin
  select * into h from public.habits where id = p_habit_id;
  if not found then
    return;
  end if;

  today := public.user_today(h.user_id);

  select min(log_date), max(log_date) filter (where status = 'done')
    into from_date, last_done
    from public.habit_logs
   where habit_id = h.id and deleted_at is null;

  from_date := greatest(least(h.start_date, coalesce(from_date, h.start_date)), today - 3650);

  if h.cadence_type in ('daily', 'weekly_days') then
    for d in
      select g::date from generate_series(from_date::timestamp, today::timestamp, interval '1 day') g
    loop
      if h.cadence_type = 'weekly_days'
         and not (coalesce(h.cadence_config -> 'days', '[]'::jsonb) @> to_jsonb(extract(dow from d)::int))
      then
        continue;
      end if;

      if exists (select 1 from public.habit_logs
                  where habit_id = h.id and log_date = d and status = 'done' and deleted_at is null) then
        run := run + 1;
        longest := greatest(longest, run);
      elsif exists (select 1 from public.habit_logs
                     where habit_id = h.id and log_date = d and status = 'skipped' and deleted_at is null)
         or exists (select 1 from public.streak_freezes where user_id = h.user_id and used_on = d) then
        null; -- protected day: no change
      elsif d = today then
        null; -- day still in progress
      else
        run := 0;
      end if;
    end loop;

  elsif h.cadence_type = 'x_per_week' then
    target := greatest(coalesce((h.cadence_config ->> 'times')::int, 1), 1);
    for w in
      select g::date from generate_series(
        date_trunc('week', from_date::timestamp),
        date_trunc('week', today::timestamp),
        interval '7 days') g
    loop
      select count(*) into cnt from public.habit_logs
       where habit_id = h.id and status = 'done' and deleted_at is null
         and log_date between w and w + 6;

      if cnt >= target then
        run := run + 1;
        longest := greatest(longest, run);
      elsif w = date_trunc('week', today::timestamp)::date then
        null; -- current week still open
      else
        run := 0;
      end if;
    end loop;

  elsif h.cadence_type = 'interval' then
    gap := greatest(coalesce((h.cadence_config ->> 'every_days')::int, 1), 1);
    prev := null;
    for d in
      select log_date from public.habit_logs
       where habit_id = h.id and status = 'done' and deleted_at is null
       order by log_date
    loop
      if prev is null or d - prev <= gap then
        run := run + 1;
      else
        run := 1;
      end if;
      longest := greatest(longest, run);
      prev := d;
    end loop;
    if last_done is null or today - last_done > gap then
      run := 0;
    end if;
  end if;

  insert into public.streaks (habit_id, current_streak, longest_streak, last_completed_date)
  values (h.id, run, longest, last_done)
  on conflict (habit_id) do update
    set current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,
        last_completed_date = excluded.last_completed_date;
end;
$$;

-- Fire after any change to a habit's logs.
create function public.habit_logs_streak_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_streak(old.habit_id);
    return old;
  end if;
  perform public.recompute_streak(new.habit_id);
  return new;
end;
$$;

create trigger habit_logs_streak
  after insert or update or delete on public.habit_logs
  for each row execute function public.habit_logs_streak_trg();

-- Cadence/start-date edits change what "scheduled" means, so re-derive.
create function public.habits_streak_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_streak(new.id);
  return new;
end;
$$;

create trigger habits_streak
  after update of cadence_type, cadence_config, start_date on public.habits
  for each row execute function public.habits_streak_trg();

-- A freeze affects every habit of that user on that day.
create function public.streak_freezes_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  for hid in select id from public.habits where user_id = new.user_id and deleted_at is null loop
    perform public.recompute_streak(hid);
  end loop;
  return new;
end;
$$;

create trigger streak_freezes_recompute
  after insert or update of used_on on public.streak_freezes
  for each row when (new.used_on is not null)
  execute function public.streak_freezes_trg();

-- None of these are callable through the API.
revoke all on function public.recompute_streak(uuid)      from public, anon, authenticated;
revoke all on function public.habit_logs_streak_trg()     from public, anon, authenticated;
revoke all on function public.habits_streak_trg()         from public, anon, authenticated;
revoke all on function public.streak_freezes_trg()        from public, anon, authenticated;
