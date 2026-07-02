-- Harden the guest-to-profile claim handoff for the future Supabase cutover.
-- This keeps the optional "save my info for next time" flow auditable and
-- attached to the customer's profile without exposing raw claim tokens.

create or replace function public.claim_guest_booking(
  booking_id_input uuid,
  claim_token_hash_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  booking_row public.bookings%rowtype;
  saved_vehicle_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select * into booking_row
  from public.bookings
  where id = booking_id_input
    and claimed_by_user_id is null
    and public.booking_claim_token_matches(claim_token_hash, claim_token_hash_input)
  for update;

  if not found then
    raise exception 'booking cannot be claimed';
  end if;

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
      booking_row.guest_name,
      booking_row.guest_phone,
      'email'
    )
    returning id into profile_id;
  else
    update public.customer_profiles
    set name = coalesce(nullif(name, ''), booking_row.guest_name),
        phone = coalesce(nullif(phone, ''), booking_row.guest_phone),
        updated_at = now()
    where id = profile_id;
  end if;

  update public.bookings
  set customer_profile_id = profile_id,
      claimed_by_user_id = auth.uid(),
      claimed_at = now(),
      updated_at = now()
  where id = booking_id_input;

  update public.messages
  set customer_profile_id = profile_id
  where booking_id = booking_id_input
    and customer_profile_id is null;

  if booking_row.guest_vehicle_label is not null
    and not exists (
      select 1
      from public.vehicles
      where customer_profile_id = profile_id
        and nickname = booking_row.guest_vehicle_label
    )
  then
    insert into public.vehicles (
      customer_profile_id,
      nickname,
      is_default
    )
    values (
      profile_id,
      booking_row.guest_vehicle_label,
      not exists (select 1 from public.vehicles where customer_profile_id = profile_id)
    )
    returning id into saved_vehicle_id;
  end if;

  if saved_vehicle_id is not null
    and exists (
      select 1
      from public.vehicles
      where id = saved_vehicle_id
        and customer_profile_id = profile_id
        and is_default = true
    )
  then
    update public.customer_profiles
    set default_vehicle_id = saved_vehicle_id,
        updated_at = now()
    where id = profile_id;
  end if;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input, 'guest_booking_claimed', 'claimed', auth.uid()
  );

  return booking_id_input;
end;
$$;

revoke all on function public.claim_guest_booking(uuid, text) from public;
grant execute on function public.claim_guest_booking(uuid, text) to authenticated;
