-- 0006: completion-rate views and the Life Score function.

-- ---------------------------------------------------------------------------
-- Expected completions for a habit over [d_from, d_to] (inclusive, clamped to start_date)
-- ---------------------------------------------------------------------------
create or replace function public.expected_in_range(h public.habits, d_from date, d_to date)
returns numeric
language sql
stable
set search_path = ''
as $$
  with r as (select greatest(d_from, h.start_date) as a, d_to as b)
  select case
    when r.b < r.a then 0::numeric
    when h.cadence_type = 'daily' then (r.b - r.a + 1)::numeric
    when h.cadence_type = 'weekly_days' then (
      select count(*)::numeric
        from generate_series(r.a::timestamp, r.b::timestamp, interval '1 day') g
       where coalesce(h.cadence_config -> 'days', '[]'::jsonb) @> to_jsonb(extract(dow from g)::int)
    )
    when h.cadence_type = 'x_per_week' then
      round(greatest(coalesce((h.cadence_config ->> 'times')::numeric, 1), 1) * (r.b - r.a + 1) / 7.0, 2)
    when h.cadence_type = 'interval' then
      floor((r.b - r.a + 1)::numeric / greatest(coalesce((h.cadence_config ->> 'every_days')::int, 1), 1))
    else 0::numeric
  end
  from r
$$;

-- ---------------------------------------------------------------------------
-- Weekly completion (last 52 weeks, Monday start) and monthly (last 12 months), per habit.
-- security_invoker => RLS of the querying user applies.
-- ---------------------------------------------------------------------------
create or replace view public.habit_completion_weekly
with (security_invoker = true) as
select
  h.id as habit_id,
  h.user_id,
  w.week_start,
  c.done_count,
  public.expected_in_range(h, w.week_start, least(w.week_start + 6, public.user_today(h.user_id))) as expected_count,
  least(1, round(
    c.done_count / nullif(public.expected_in_range(h, w.week_start, least(w.week_start + 6, public.user_today(h.user_id))), 0),
    4)) as completion_rate
from public.habits h
cross join lateral (
  select g::date as week_start
    from generate_series(
      date_trunc('week', public.user_today(h.user_id)::timestamp) - interval '357 days',
      date_trunc('week', public.user_today(h.user_id)::timestamp),
      interval '7 days') g
) w
cross join lateral (
  select count(*)::int as done_count
    from public.habit_logs l
   where l.habit_id = h.id and l.status = 'done' and l.deleted_at is null
     and l.log_date between w.week_start and w.week_start + 6
) c
where h.deleted_at is null
  and w.week_start + 6 >= h.start_date;

create or replace view public.habit_completion_monthly
with (security_invoker = true) as
select
  h.id as habit_id,
  h.user_id,
  m.month_start,
  c.done_count,
  public.expected_in_range(h, m.month_start, least((m.month_start + interval '1 month - 1 day')::date, public.user_today(h.user_id))) as expected_count,
  least(1, round(
    c.done_count / nullif(public.expected_in_range(h, m.month_start, least((m.month_start + interval '1 month - 1 day')::date, public.user_today(h.user_id))), 0),
    4)) as completion_rate
from public.habits h
cross join lateral (
  select g::date as month_start
    from generate_series(
      date_trunc('month', public.user_today(h.user_id)::timestamp) - interval '11 months',
      date_trunc('month', public.user_today(h.user_id)::timestamp),
      interval '1 month') g
) m
cross join lateral (
  select count(*)::int as done_count
    from public.habit_logs l
   where l.habit_id = h.id and l.status = 'done' and l.deleted_at is null
     and l.log_date between m.month_start and (m.month_start + interval '1 month - 1 day')::date
) c
where h.deleted_at is null
  and (m.month_start + interval '1 month - 1 day')::date >= h.start_date;

grant select on public.habit_completion_weekly, public.habit_completion_monthly to authenticated;

-- ---------------------------------------------------------------------------
-- Life Score (0-100), over the trailing 30 days:
--   40%  consistency                 done / expected across active habits
--   20%  streak health               mean of min(current_streak, 30)/30
--   20%  difficulty-adjusted         consistency, weighting each habit by a difficulty proxy
--   10%  mood trend                  last-7-day mood level, nudged by change vs the 7 days before
--   10%  journaling                  entries in 30 days, 15+ = full marks
--
-- DIFFICULTY PROXY: the schema has no difficulty column yet, so weight =
--   1 + min(ln(max(target_value,1)), 2) + (0.5 if daily). Replace once a real field exists.
-- ---------------------------------------------------------------------------
create or replace function public.life_score(p_user uuid default auth.uid(), p_as_of date default null)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  today         date := coalesce(p_as_of, public.user_today(p_user));
  from30        date;
  habit_count   integer;
  consistency   numeric := 0;
  diff_adj      numeric := 0;
  streak_health numeric := 0;
  m_recent      numeric;
  m_prev        numeric;
  mood_score    numeric := 50;
  n_journal     integer;
  journaling    numeric;
begin
  from30 := today - 29;

  select count(*) into habit_count
    from public.habits
   where user_id = p_user and deleted_at is null and archived_at is null;

  if habit_count = 0 then
    return 0;
  end if;

  select
    coalesce(sum(least(done, exp)) / nullif(sum(exp), 0), 0),
    coalesce(sum(least(done, exp) * w) / nullif(sum(exp * w), 0), 0)
  into consistency, diff_adj
  from (
    select
      public.expected_in_range(h, from30, today) as exp,
      (select count(*) from public.habit_logs l
        where l.habit_id = h.id and l.status = 'done' and l.deleted_at is null
          and l.log_date between from30 and today)::numeric as done,
      1 + least(ln(greatest(h.target_value, 1)), 2) + case when h.cadence_type = 'daily' then 0.5 else 0 end as w
    from public.habits h
    where h.user_id = p_user and h.deleted_at is null and h.archived_at is null
  ) x;

  select coalesce(avg(least(coalesce(s.current_streak, 0), 30) / 30.0), 0)
    into streak_health
    from public.habits h
    left join public.streaks s on s.habit_id = h.id
   where h.user_id = p_user and h.deleted_at is null and h.archived_at is null;

  select avg(mood) filter (where d > today - 7),
         avg(mood) filter (where d <= today - 7 and d > today - 14)
    into m_recent, m_prev
    from (
      select log_date as d, mood::numeric as mood from public.habit_logs
       where user_id = p_user and mood is not null and deleted_at is null and log_date > today - 14
      union all
      select entry_date, mood::numeric from public.journal_entries
       where user_id = p_user and mood is not null and deleted_at is null and entry_date > today - 14
    ) m;

  if m_recent is not null then
    mood_score := (m_recent - 1) / 4 * 100
                  + greatest(-20, least(20, coalesce(m_recent - m_prev, 0) * 10));
    mood_score := greatest(0, least(100, mood_score));
  end if;

  select count(*) into n_journal
    from public.journal_entries
   where user_id = p_user and deleted_at is null and char_length(btrim(body)) > 0
     and entry_date between from30 and today;
  journaling := least(1, n_journal / 15.0) * 100;

  return round(
      0.40 * consistency * 100
    + 0.20 * streak_health * 100
    + 0.20 * diff_adj * 100
    + 0.10 * mood_score
    + 0.10 * journaling, 1);
end;
$$;

-- Clients can't write user_progress, so refreshing goes through this definer function,
-- which only ever touches auth.uid()'s own row.
create or replace function public.refresh_life_score()
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  score numeric;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  score := public.life_score(uid);
  update public.user_progress set life_score = score where user_id = uid;
  return score;
end;
$$;

revoke all on function public.refresh_life_score() from public, anon;
grant execute on function public.refresh_life_score() to authenticated;
