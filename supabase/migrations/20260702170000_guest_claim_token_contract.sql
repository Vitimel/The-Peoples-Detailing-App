-- Make the guest booking claim flow usable before Supabase goes live.
-- The customer receives a one-time opaque claim token after booking. The
-- database stores only its hash, so the token can later claim or manage the
-- guest booking without exposing app-fee/payment/internal rows.

create or replace function public.hash_claim_token(token_input text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(digest(token_input, 'sha256'), 'hex');
$$;

create or replace function public.booking_claim_token_matches(
  stored_hash text,
  token_input text
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select token_input is not null
    and stored_hash is not null
    and stored_hash = public.hash_claim_token(token_input);
$$;

drop function if exists public.create_guest_booking(jsonb);

create function public.create_guest_booking(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_booking_id uuid;
  raw_claim_token text := encode(gen_random_bytes(32), 'hex');
  service_row public.services%rowtype;
  requested_start timestamptz;
  requested_end timestamptz;
  local_start timestamp;
  local_hour numeric;
  requested_time_label text;
  status_to_insert public.booking_status := 'confirmed';
  short_notice boolean := false;
  app_fee_cents integer := public.setting_number('company_app_fee_cents', 300)::integer;
  deposit_cents integer := public.setting_number('deposit_cents', 2500)::integer;
  owner_sms_cents integer := public.setting_number('owner_sms_estimate_cents', 1)::integer;
begin
  if coalesce(payload->>'service_id', '') = '' then
    raise exception 'service_id is required';
  end if;

  select * into service_row
  from public.services
  where id = payload->>'service_id' and visible = true;

  if not found then
    raise exception 'service is not available';
  end if;

  requested_start := nullif(payload->>'start_at', '')::timestamptz;
  if requested_start is null then
    raise exception 'start_at is required';
  end if;

  if requested_start < now() then
    raise exception 'booking time must be in the future';
  end if;

  if length(trim(coalesce(payload->>'address', ''))) < 5 then
    raise exception 'service address is required';
  end if;

  local_start := requested_start at time zone 'America/Chicago';
  local_hour := extract(hour from local_start) + extract(minute from local_start) / 60.0;
  requested_time_label := coalesce(nullif(payload->>'time_label', ''), public.local_time_label(requested_start));
  requested_end := public.booking_end_at(service_row.id, requested_start);

  if local_hour < public.setting_number('working_hours_start', 8)
    or local_hour >= public.setting_number('working_hours_end', 19.5)
    or extract(hour from requested_end at time zone 'America/Chicago') + extract(minute from requested_end at time zone 'America/Chicago') / 60.0 > public.setting_number('working_hours_end', 19.5)
  then
    raise exception 'requested time is outside working hours';
  end if;

  if exists (
    select 1 from public.availability_blocks
    where block_date = (local_start::date)
      and (
        block_type = 'full_day'
        or (block_type = 'time_slot' and time_label = requested_time_label)
      )
  ) then
    raise exception 'requested time is blocked';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.status in ('requested', 'confirmed')
      and tstzrange(b.start_at, public.booking_end_at(b.service_id, b.start_at), '[)')
        && tstzrange(requested_start, requested_end, '[)')
  ) then
    raise exception 'requested time is already booked';
  end if;

  if requested_start < now() + make_interval(hours => public.setting_number('minimum_booking_notice_hours', 48)::integer) then
    status_to_insert := 'requested';
    short_notice := true;
  end if;

  insert into public.bookings (
    service_id, service_title, price_cents, start_at, address, lat, lng,
    travel_miles, travel_fee_cents, discount_cents, total_cents, status,
    short_notice_request, owner_ack_status, guest_name, guest_phone,
    guest_vehicle_label, claim_token_hash
  )
  values (
    service_row.id,
    service_row.title,
    service_row.price_cents,
    requested_start,
    trim(payload->>'address'),
    nullif(payload->>'lat', '')::numeric,
    nullif(payload->>'lng', '')::numeric,
    coalesce((payload->>'travel_miles')::numeric, 0),
    coalesce((payload->>'travel_fee_cents')::integer, 0),
    coalesce((payload->>'discount_cents')::integer, 0),
    greatest(0, service_row.price_cents + coalesce((payload->>'travel_fee_cents')::integer, 0) - coalesce((payload->>'discount_cents')::integer, 0)),
    status_to_insert,
    short_notice,
    case when status_to_insert = 'confirmed' then 'needs_ack' else 'approval_needed' end,
    nullif(trim(coalesce(payload->>'guest_name', '')), ''),
    nullif(trim(coalesce(payload->>'guest_phone', '')), ''),
    nullif(trim(coalesce(payload->>'guest_vehicle_label', '')), ''),
    public.hash_claim_token(raw_claim_token)
  )
  returning id into new_booking_id;

  insert into public.owner_acknowledgments (booking_id, status)
  values (new_booking_id, case when status_to_insert = 'confirmed' then 'needs_ack' else 'approval_needed' end);

  insert into public.status_events (booking_id, event_type, status)
  values (new_booking_id, case when status_to_insert = 'confirmed' then 'booking_confirmed' else 'booking_requested' end, status_to_insert::text);

  insert into public.payment_placeholders (
    booking_id, provider, mode, application_fee_amount_cents, amount_cents,
    deposit_cents, card_processing_fee_cents, routing_status, live_mode
  )
  values (
    new_booking_id, 'stripe', 'test_mode_ready_not_connected', app_fee_cents, 0,
    deposit_cents, 0, 'ledger_only', false
  );

  insert into public.app_fee_ledger_entries (
    booking_id, gross_app_fee_cents, sms_estimate_cents,
    net_brandnew_estimate_cents, routing_status, sms_cost_status, visible_to_customer
  )
  values (
    new_booking_id, app_fee_cents, owner_sms_cents,
    greatest(0, app_fee_cents - owner_sms_cents), 'ledger_only', 'estimated_not_billed', false
  );

  insert into public.sms_notifications (
    booking_id, audience, provider, to_role, status,
    cost_estimate_cents, cost_status, body_preview
  )
  values (
    new_booking_id, 'owner', 'not_connected', 'owner', 'would_send',
    owner_sms_cents, 'estimated_not_billed',
    case when status_to_insert = 'requested'
      then service_row.title || ' request needs approval.'
      else service_row.title || ' booked and needs acknowledgment.'
    end
  );

  return jsonb_build_object(
    'booking_id', new_booking_id,
    'claim_token', raw_claim_token,
    'status', status_to_insert,
    'short_notice_request', short_notice
  );
end;
$$;

revoke all on function public.create_guest_booking(jsonb) from public;
grant execute on function public.create_guest_booking(jsonb) to anon, authenticated;

create or replace function public.claim_guest_booking(booking_id_input uuid, claim_token_hash_input text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id uuid;
  booking_row public.bookings%rowtype;
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
  end if;

  update public.bookings
  set customer_profile_id = profile_id,
      claimed_by_user_id = auth.uid(),
      claimed_at = now(),
      updated_at = now()
  where id = booking_id_input;

  if booking_row.guest_vehicle_label is not null
    and not exists (
      select 1 from public.vehicles
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
    );
  end if;

  return booking_id_input;
end;
$$;

create or replace function public.can_access_booking(
  booking_id_input uuid,
  claim_token_hash_input text default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = booking_id_input
      and (
        public.is_owner_or_developer()
        or b.claimed_by_user_id = auth.uid()
        or public.booking_claim_token_matches(b.claim_token_hash, claim_token_hash_input)
      )
  );
$$;

revoke all on function public.hash_claim_token(text) from public;
revoke all on function public.booking_claim_token_matches(text, text) from public;
revoke all on function public.claim_guest_booking(uuid, text) from public;
revoke all on function public.can_access_booking(uuid, text) from public;

grant execute on function public.claim_guest_booking(uuid, text) to authenticated;
