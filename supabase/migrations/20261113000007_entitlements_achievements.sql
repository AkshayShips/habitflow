-- 0007: entitlement helper + achievements catalog.

-- Server-side "is this user Pro?" for Edge Functions and (optional) triggers.
-- Not callable by clients: they can read their own subscriptions_cache row via RLS, and exposing a
-- uuid-parameterised definer function would let anyone probe other users' subscription state.
-- Billing retry is deliberately NOT treated as entitled; RevenueCat reports in_grace_period while
-- access should continue.
create or replace function public.has_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions_cache s
     where s.user_id = p_user
       and s.entitlement = 'pro'
       and s.status in ('active', 'in_grace_period')
       and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.has_pro(uuid) from public, anon, authenticated;

insert into public.achievements (key, title, description) values
  ('first_habit',    'First step',        'Created your first habit.'),
  ('first_checkin',  'Showing up',        'Completed a habit for the first time.'),
  ('streak_7',       'One good week',     'Kept a streak going for 7 days.'),
  ('streak_30',      'A month of care',   'Kept a streak going for 30 days.'),
  ('streak_100',     'Steady as she goes','Kept a streak going for 100 days.'),
  ('perfect_day',    'Full circle',       'Completed every habit scheduled for a day.'),
  ('first_journal',  'Pen to paper',      'Wrote your first journal entry.'),
  ('level_5',        'Finding your rhythm','Reached level 5.')
on conflict (key) do nothing;
