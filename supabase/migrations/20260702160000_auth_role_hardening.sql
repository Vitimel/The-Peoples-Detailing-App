-- Repo-ready Auth/RLS hardening. This keeps app-role checks reliable once
-- Supabase Auth is connected, without enabling live customer data yet.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'customer'::public.app_role
  );
$$;

create or replace function public.is_owner_or_developer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('owner', 'developer');
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (
    id,
    role,
    name,
    phone,
    notification_preference
  )
  values (
    new.id,
    'customer',
    nullif(trim(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'notification_preference'), ''), 'email')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop policy if exists "profiles update own basic fields or developer role" on public.profiles;
create policy "profiles update own basic fields or developer role"
  on public.profiles
  for update
  using (id = auth.uid() or public.current_app_role() = 'developer')
  with check (
    id = auth.uid()
    or public.current_app_role() = 'developer'
  );

create or replace function public.developer_assign_app_role(
  target_user_id uuid,
  new_role public.app_role,
  name_input text default null,
  phone_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_developer();

  if target_user_id is null then
    raise exception 'target user id is required';
  end if;

  if target_user_id = auth.uid() and new_role <> 'developer' then
    raise exception 'developer cannot remove their own developer role';
  end if;

  insert into public.profiles (
    id,
    role,
    name,
    phone,
    notification_preference
  )
  values (
    target_user_id,
    new_role,
    nullif(trim(coalesce(name_input, '')), ''),
    nullif(trim(coalesce(phone_input, '')), ''),
    'email'
  )
  on conflict (id) do update set
    role = excluded.role,
    name = coalesce(nullif(trim(coalesce(name_input, '')), ''), public.profiles.name),
    phone = coalesce(nullif(trim(coalesce(phone_input, '')), ''), public.profiles.phone),
    updated_at = now();

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    null, 'developer_assigned_app_role', target_user_id::text || ':' || new_role::text, auth.uid()
  );

  return target_user_id;
end;
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_owner_or_developer() from public;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.developer_assign_app_role(uuid, public.app_role, text, text) from public;

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_owner_or_developer() to anon, authenticated;
grant execute on function public.developer_assign_app_role(uuid, public.app_role, text, text) to authenticated;
