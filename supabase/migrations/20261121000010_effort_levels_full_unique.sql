-- Identity of an effort level is (habit_id, level), like habit_logs is (habit_id, log_date). A full unique
-- constraint (not partial) lets the client upsert with onConflict; deletes are soft and the row is revived on re-create.
drop index public.habit_effort_levels_live_uidx;
alter table public.habit_effort_levels
  add constraint habit_effort_levels_habit_level_key unique (habit_id, level);
