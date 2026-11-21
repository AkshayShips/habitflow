-- 0004: bootstrap rows when a user signs up (works for guest/anonymous users too).
-- Guest -> full account upgrades keep the SAME auth.users.id (updateUser / linkIdentity),
-- so nothing here needs to run again and no data has to be migrated.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
begin
  if not public.is_valid_timezone(tz) then
    tz := 'UTC';
  end if;

  insert into public.profiles (id, display_name, timezone, locale)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80), ''),
    tz,
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  )
  on conflict (id) do nothing;

  insert into public.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions must never be callable via the API.
revoke all on function public.handle_new_user()   from public, anon, authenticated;
revoke all on function public.lww_guard()         from public, anon, authenticated;
revoke all on function public.set_updated_at()    from public, anon, authenticated;
