-- 0009: Adaptive Momentum sync tables: per-habit effort levels and short experiments.
-- Same conventions as habits/habit_logs: client-owned, soft delete, last-write-wins via lww_guard,
-- owner-only RLS, and the habit must belong to the caller. Completion RESULTS are never stored; they are computed
-- from habit_logs, so history can't be rewritten by an experiment.

-- ---------------------------------------------------------------------------
-- habit_effort_levels: the user's own minimum / standard / extended targets for a habit.
-- ---------------------------------------------------------------------------
create table public.habit_effort_levels (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  habit_id     uuid not null references public.habits (id) on delete cascade,
  level        text not null check (level in ('minimum', 'standard', 'extended')),
  target_value numeric not null check (target_value > 0 and target_value <= 100000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- (Replaced in 0010 by a full unique constraint on (habit_id, level).)
create unique index habit_effort_levels_live_uidx
  on public.habit_effort_levels (habit_id, level) where deleted_at is null;
create index habit_effort_levels_user_updated_idx on public.habit_effort_levels (user_id, updated_at, id);

create trigger habit_effort_levels_lww
  before insert or update on public.habit_effort_levels
  for each row execute function public.lww_guard();

-- ---------------------------------------------------------------------------
-- momentum_experiments: "try a different target for N days", always the user's choice.
-- ---------------------------------------------------------------------------
create table public.momentum_experiments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  habit_id              uuid not null references public.habits (id) on delete cascade,
  start_date            date not null,
  duration_days         smallint not null check (duration_days between 3 and 60),
  baseline_target_value numeric not null check (baseline_target_value > 0),
  trial_target_value    numeric not null check (trial_target_value > 0),
  status                text not null default 'running' check (status in ('running', 'kept', 'discarded')),
  decided_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  check (status = 'running' or decided_at is not null)
);

-- At most one running experiment per habit.
create unique index momentum_experiments_one_running_uidx
  on public.momentum_experiments (habit_id) where status = 'running' and deleted_at is null;
create index momentum_experiments_user_updated_idx on public.momentum_experiments (user_id, updated_at, id);

create trigger momentum_experiments_lww
  before insert or update on public.momentum_experiments
  for each row execute function public.lww_guard();

-- ---------------------------------------------------------------------------
-- RLS: owner-only CRUD; inserts/updates must reference one of the caller's own habits.
-- ---------------------------------------------------------------------------
alter table public.habit_effort_levels enable row level security;
alter table public.momentum_experiments enable row level security;

create policy habit_effort_levels_select_own on public.habit_effort_levels
  for select to authenticated using (user_id = (select auth.uid()));
create policy habit_effort_levels_insert_own on public.habit_effort_levels
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy habit_effort_levels_update_own on public.habit_effort_levels
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy habit_effort_levels_delete_own on public.habit_effort_levels
  for delete to authenticated using (user_id = (select auth.uid()));

create policy momentum_experiments_select_own on public.momentum_experiments
  for select to authenticated using (user_id = (select auth.uid()));
create policy momentum_experiments_insert_own on public.momentum_experiments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy momentum_experiments_update_own on public.momentum_experiments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy momentum_experiments_delete_own on public.momentum_experiments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Table privileges follow the existing pattern (RLS does the row filtering).
revoke all on public.habit_effort_levels from anon;
revoke all on public.momentum_experiments from anon;
grant select, insert, update, delete on public.habit_effort_levels to authenticated;
grant select, insert, update, delete on public.momentum_experiments to authenticated;
