-- Finish the repo-ready booking contract without connecting a live project.
-- This migration is designed for Supabase Free/Postgres and keeps provider
-- integrations queued/placeholder-only until explicit go-live approval.

alter table public.services
  add column if not exists duration_minutes integer not null default 120 check (duration_minutes > 0),
  add column if not exists buffer_minutes integer not null default 30 check (buffer_minutes >= 0);

update public.services
set duration_minutes = greatest(60, round(duration_hours * 60)::integer)
where duration_minutes = 120 and duration_hours is not null;

create table if not exists public.business_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

create policy "public reads safe business settings" on public.business_settings
  for select using (key in (
    'working_hours_start',
    'working_hours_end',
    'minimum_booking_notice_hours',
    'reschedule_cutoff_hours',
    'cancel_deposit_forfeit_days',
    'free_travel_radius_miles',
    'per_mile_fee_cents',
    'company_app_fee_cents',
    'deposit_cents',
    'owner_sms_estimate_cents'
  ));

create policy "developer manages business settings" on public.business_settings
  for all using (public.current_app_role() = 'developer')
  with check (public.current_app_role() = 'developer');

insert into public.business_settings (key, value) values
  ('working_hours_start', '8'::jsonb),
  ('working_hours_end', '19.5'::jsonb),
  ('minimum_booking_notice_hours', '48'::jsonb),
  ('reschedule_cutoff_hours', '48'::jsonb),
  ('cancel_deposit_forfeit_days', '7'::jsonb),
  ('free_travel_radius_miles', '10'::jsonb),
  ('per_mile_fee_cents', '150'::jsonb),
  ('company_app_fee_cents', '300'::jsonb),
  ('deposit_cents', '2500'::jsonb),
  ('owner_sms_estimate_cents', '1'::jsonb)
on conflict (key) do nothing;

create index if not exists bookings_active_start_idx
  on public.bookings (start_at)
  where status in ('requested', 'confirmed');

create index if not exists availability_blocks_date_type_idx
  on public.availability_blocks (block_date, block_type, time_label);

create or replace function public.setting_number(setting_key text, fallback numeric)
returns numeric
language sql
stable
as $$
  select coalesce((select (value #>> '{}')::numeric from public.business_settings where key = setting_key), fallback);
$$;

create or replace function public.local_time_label(input_at timestamptz)
returns text
language sql
stable
as $$
  select trim(to_char(input_at at time zone 'America/Chicago', 'FMHH12:MI AM'));
$$;

create or replace function public.booking_duration_minutes(service_id_input text)
returns integer
language sql
stable
as $$
  select coalesce(
    (select duration_minutes + buffer_minutes from public.services where id = service_id_input),
    150
  );
$$;

create or replace function public.booking_end_at(service_id_input text, start_at_input timestamptz)
returns timestamptz
language sql
stable
as $$
  select start_at_input + make_interval(mins => public.booking_duration_minutes(service_id_input));
$$;

create or replace function public.create_guest_booking(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_booking_id uuid;
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
    encode(digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'hex')
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

  return new_booking_id;
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
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  update public.bookings
  set claimed_by_user_id = auth.uid(),
      claimed_at = now(),
      updated_at = now()
  where id = booking_id_input
    and claimed_by_user_id is null
    and claim_token_hash = claim_token_hash_input
  returning customer_profile_id into profile_id;

  if not found then
    raise exception 'booking cannot be claimed';
  end if;

  return booking_id_input;
end;
$$;

revoke all on function public.claim_guest_booking(uuid, text) from public;
grant execute on function public.claim_guest_booking(uuid, text) to authenticated;
