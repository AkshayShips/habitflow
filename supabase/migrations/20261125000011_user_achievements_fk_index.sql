-- Covers the user_achievements.achievement_id foreign key (flagged by the performance advisor).
create index if not exists user_achievements_achievement_id_idx on public.user_achievements (achievement_id);
