-- Signed-in customer profile and saved-vehicle RPCs for the future Supabase
-- cutover. These keep repeat-customer data behind auth-owned functions instead
-- of requiring the frontend to read/write raw profile and vehicle tables.

create index if not exists customer_profiles_user_created_idx
  on public.customer_profiles (user_id, created_at);

create index if not exists vehicles_customer_profile_created_idx
  on public.vehicles (customer_profile_id, created_at);

create or replace function public.customer_ensure_profile()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  auth_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select * into auth_profile
  from public.profiles
  where id = auth.uid();

  select id into profile_id
  from public.customer_profiles
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  if profile_id is null then
    insert into public.customer_profiles (
      user_id,
      name,
      phone,
      notification_preference
    )
    values (
      auth.uid(),
      auth_profile.name,
      auth_profile.phone,
      coalesce(auth_profile.notification_preference, 'email')
    )
    returning id into profile_id;
  end if;

  return profile_id;
end;
$$;

create or replace function public.get_my_customer_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  profile_row public.customer_profiles%rowtype;
begin
  profile_id := public.customer_ensure_profile();

  select * into profile_row
  from public.customer_profiles
  where id = profile_id;

  return jsonb_build_object(
    'id', profile_row.id,
    'user_id', profile_row.user_id,
    'name', profile_row.name,
    'phone', profile_row.phone,
    'default_vehicle_id', profile_row.default_vehicle_id,
    'notification_preference', profile_row.notification_preference,
    'created_at', profile_row.created_at,
    'updated_at', profile_row.updated_at,
    'vehicles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'nickname', v.nickname,
          'year', v.year,
          'make', v.make,
          'model', v.model,
          'color', v.color,
          'plate', v.plate,
          'vin', v.vin,
          'is_default', v.is_default,
          'created_at', v.created_at,
          'updated_at', v.updated_at
        )
        order by v.is_default desc, v.created_at asc
      )
      from public.vehicles v
      where v.customer_profile_id = profile_row.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.upsert_my_customer_profile(
  name_input text default null,
  phone_input text default null,
  notification_preference_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  clean_name text := nullif(trim(coalesce(name_input, '')), '');
  clean_phone text := nullif(trim(coalesce(phone_input, '')), '');
  clean_preference text := coalesce(nullif(trim(coalesce(notification_preference_input, '')), ''), 'email');
begin
  if clean_preference not in ('email', 'sms', 'phone', 'none') then
    raise exception 'notification preference must be email, sms, phone, or none';
  end if;

  profile_id := public.customer_ensure_profile();

  update public.customer_profiles
  set name = clean_name,
      phone = clean_phone,
      notification_preference = clean_preference,
      updated_at = now()
  where id = profile_id
    and user_id = auth.uid();

  update public.profiles
  set name = clean_name,
      phone = clean_phone,
      notification_preference = clean_preference,
      updated_at = now()
  where id = auth.uid();

  return public.get_my_customer_profile();
end;
$$;

create or replace function public.upsert_my_vehicle(
  vehicle_id_input uuid default null,
  nickname_input text default null,
  year_input text default null,
  make_input text default null,
  model_input text default null,
  color_input text default null,
  plate_input text default null,
  vin_input text default null,
  is_default_input boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  saved_vehicle_id uuid;
  clean_nickname text := nullif(trim(coalesce(nickname_input, '')), '');
begin
  if clean_nickname is null then
    raise exception 'vehicle nickname is required';
  end if;

  profile_id := public.customer_ensure_profile();

  if vehicle_id_input is not null then
    update public.vehicles
    set nickname = clean_nickname,
        year = nullif(trim(coalesce(year_input, '')), ''),
        make = nullif(trim(coalesce(make_input, '')), ''),
        model = nullif(trim(coalesce(model_input, '')), ''),
        color = nullif(trim(coalesce(color_input, '')), ''),
        plate = nullif(trim(coalesce(plate_input, '')), ''),
        vin = nullif(trim(coalesce(vin_input, '')), ''),
        is_default = coalesce(is_default_input, false),
        updated_at = now()
    where id = vehicle_id_input
      and customer_profile_id = profile_id
    returning id into saved_vehicle_id;

    if saved_vehicle_id is null then
      raise exception 'vehicle not found';
    end if;
  else
    insert into public.vehicles (
      customer_profile_id,
      nickname,
      year,
      make,
      model,
      color,
      plate,
      vin,
      is_default
    )
    values (
      profile_id,
      clean_nickname,
      nullif(trim(coalesce(year_input, '')), ''),
      nullif(trim(coalesce(make_input, '')), ''),
      nullif(trim(coalesce(model_input, '')), ''),
      nullif(trim(coalesce(color_input, '')), ''),
      nullif(trim(coalesce(plate_input, '')), ''),
      nullif(trim(coalesce(vin_input, '')), ''),
      coalesce(is_default_input, false)
        or not exists (select 1 from public.vehicles where customer_profile_id = profile_id)
    )
    returning id into saved_vehicle_id;
  end if;

  if exists (
    select 1
    from public.vehicles
    where id = saved_vehicle_id
      and customer_profile_id = profile_id
      and is_default = true
  ) then
    update public.vehicles
    set is_default = (id = saved_vehicle_id),
        updated_at = now()
    where customer_profile_id = profile_id;

    update public.customer_profiles
    set default_vehicle_id = saved_vehicle_id,
        updated_at = now()
    where id = profile_id;
  end if;

  if not exists (
    select 1
    from public.vehicles
    where customer_profile_id = profile_id
      and is_default = true
  ) then
    update public.vehicles
    set is_default = (id = saved_vehicle_id),
        updated_at = now()
    where customer_profile_id = profile_id;

    update public.customer_profiles
    set default_vehicle_id = saved_vehicle_id,
        updated_at = now()
    where id = profile_id;
  end if;

  return public.get_my_customer_profile();
end;
$$;

create or replace function public.delete_my_vehicle(vehicle_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  deleted_default boolean := false;
  replacement_vehicle_id uuid;
begin
  if vehicle_id_input is null then
    raise exception 'vehicle id is required';
  end if;

  profile_id := public.customer_ensure_profile();

  select is_default into deleted_default
  from public.vehicles
  where id = vehicle_id_input
    and customer_profile_id = profile_id;

  if not found then
    raise exception 'vehicle not found';
  end if;

  delete from public.vehicles
  where id = vehicle_id_input
    and customer_profile_id = profile_id;

  if deleted_default then
    select id into replacement_vehicle_id
    from public.vehicles
    where customer_profile_id = profile_id
    order by created_at asc
    limit 1;

    if replacement_vehicle_id is not null then
      update public.vehicles
      set is_default = (id = replacement_vehicle_id),
          updated_at = now()
      where customer_profile_id = profile_id;
    end if;

    update public.customer_profiles
    set default_vehicle_id = replacement_vehicle_id,
        updated_at = now()
    where id = profile_id;
  end if;

  return public.get_my_customer_profile();
end;
$$;

revoke all on function public.customer_ensure_profile() from public;
revoke all on function public.get_my_customer_profile() from public;
revoke all on function public.upsert_my_customer_profile(text, text, text) from public;
revoke all on function public.upsert_my_vehicle(uuid, text, text, text, text, text, text, text, boolean) from public;
revoke all on function public.delete_my_vehicle(uuid) from public;

grant execute on function public.get_my_customer_profile() to authenticated;
grant execute on function public.upsert_my_customer_profile(text, text, text) to authenticated;
grant execute on function public.upsert_my_vehicle(uuid, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.delete_my_vehicle(uuid) to authenticated;
