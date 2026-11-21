-- Demo data for local dev and App Review.
--
-- 1. Supabase dashboard > Authentication > Users > Add user:
--      email demo@habitflow.app  + a password you choose (auto-confirm ON).
--    (The password lives only in the dashboard / App Review notes, never in this repo.)
-- 2. Run this file in the SQL editor (or `psql -f db/seed.sql`). It is idempotent: it wipes and
--    rebuilds that user's habits, logs and journal entries.

do $$
declare
  uid   uuid;
  tz    text := 'America/New_York';
  today date;
begin
  select id into uid from auth.users where email = 'demo@habitflow.app';
  if uid is null then
    raise exception 'Create the demo user (demo@habitflow.app) in the dashboard first.';
  end if;

  today := public.local_date(now(), tz);

  update public.profiles
     set timezone = tz, display_name = 'Demo', onboarding_goal = 'build_routines'
   where id = uid;

  delete from public.habits where user_id = uid;          -- cascades to logs + streaks
  delete from public.journal_entries where user_id = uid;

  insert into public.habits
    (user_id, name, icon, color, category, cadence_type, cadence_config, target_value, unit, start_date, sort_order)
  values
    (uid, 'Morning walk', 'walk',        '#4FB286', 'Health',       'daily',       '{}',                 1,  null,    today - 90, 0),
    (uid, 'Read',         'book',        '#5B8DEF', 'Learning',     'daily',       '{}',                 20, 'pages', today - 90, 1),
    (uid, 'Gym',          'barbell',     '#E07B5B', 'Health',       'weekly_days', '{"days":[1,3,5]}',   1,  null,    today - 90, 2),
    (uid, 'Deep work',    'laptop',      '#8E7CE0', 'Productivity', 'x_per_week',  '{"times":4}',        1,  null,    today - 90, 3),
    (uid, 'Meditate',     'leaf',        '#4BB3C4', 'Mindfulness',  'daily',       '{}',                 10, 'min',   today - 90, 4);

  insert into public.habit_logs (habit_id, user_id, log_date, value, status, mood, logged_at)
  select h.id, uid, g::date, h.target_value, 'done',
         case when abs(hashtext('m' || h.id::text || g::text)) % 3 = 0
              then 3 + abs(hashtext('v' || g::text)) % 3 end,
         ((g::date + time '20:00') at time zone tz)
    from public.habits h
    cross join generate_series((today - 59)::timestamp, today::timestamp, interval '1 day') g
   where h.user_id = uid
     and (h.cadence_type <> 'weekly_days'
          or (h.cadence_config -> 'days') @> to_jsonb(extract(dow from g)::int))
     and abs(hashtext(h.id::text || g::text)) % 100 <
         case h.name when 'Morning walk' then 82 when 'Read' then 68 when 'Gym' then 78
                     when 'Deep work' then 62 else 55 end;

  insert into public.journal_entries (user_id, entry_date, body, mood)
  select uid, g::date, 'Demo entry for ' || g::date, 2 + abs(hashtext(g::text)) % 4
    from generate_series((today - 29)::timestamp, today::timestamp, interval '3 days') g;

  update public.user_progress set xp = 1240, level = 4 where user_id = uid;
  perform public.recompute_streak(id) from public.habits where user_id = uid;
  update public.user_progress set life_score = public.life_score(uid) where user_id = uid;
end $$;
