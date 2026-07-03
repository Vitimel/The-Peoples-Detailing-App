-- Align guest booking creation with the server-owned checkout quote.
-- The quote is recorded as future-payment intent, but actual online money
-- remains $0 until Stripe test/live mode is separately approved.

alter table public.payment_placeholders
  add column if not exists payment_choice text,
  add column if not exists quoted_job_total_cents integer not null default 0,
  add column if not exists quoted_amount_before_card_fee_cents integer not null default 0,
  add column if not exists quoted_due_today_cents integer not null default 0,
  add column if not exists balance_due_cents integer not null default 0,
  add column if not exists no_real_payment_collected boolean not null default true;

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
  quote jsonb;
  requested_start timestamptz;
  requested_end timestamptz;
  local_start timestamp;
  local_hour numeric;
  requested_time_label text;
  status_to_insert public.booking_status := 'confirmed';
  short_notice boolean := false;
  app_fee_cents integer := public.setting_number('company_app_fee_cents', 300)::integer;
  owner_sms_cents integer := public.setting_number('owner_sms_estimate_cents', 1)::integer;
  quote_payment_choice text;
  quote_job_total_cents integer;
  quote_amount_before_card_fee_cents integer;
  quote_card_processing_fee_cents integer;
  quote_due_today_cents integer;
  quote_balance_due_cents integer;
begin
  quote := public.get_checkout_quote(payload);
  quote_payment_choice := quote->>'payment_choice';
  quote_job_total_cents := (quote->>'job_total_cents')::integer;
  quote_amount_before_card_fee_cents := (quote->>'amount_paid_before_card_fee_cents')::integer;
  quote_card_processing_fee_cents := (quote->>'card_processing_fee_cents')::integer;
  quote_due_today_cents := (quote->>'total_due_today_cents')::integer;
  quote_balance_due_cents := (quote->>'balance_due_cents')::integer;

  select * into service_row
  from public.services
  where id = quote->>'service_id' and visible = true;

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
    guest_vehicle_label, claim_token_hash, payment_status,
    original_balance_due_cents, balance_due_cents
  )
  values (
    service_row.id,
    service_row.title,
    service_row.price_cents,
    requested_start,
    trim(payload->>'address'),
    nullif(payload->>'lat', '')::numeric,
    nullif(payload->>'lng', '')::numeric,
    coalesce(nullif(payload->>'travel_miles', '')::numeric, 0),
    (quote->>'travel_fee_cents')::integer,
    (quote->>'discount_cents')::integer,
    quote_job_total_cents,
    status_to_insert,
    short_notice,
    case when status_to_insert = 'confirmed' then 'needs_ack' else 'approval_needed' end,
    nullif(trim(coalesce(payload->>'guest_name', '')), ''),
    nullif(trim(coalesce(payload->>'guest_phone', '')), ''),
    nullif(trim(coalesce(payload->>'guest_vehicle_label', '')), ''),
    public.hash_claim_token(raw_claim_token),
    'not_collected',
    quote_job_total_cents,
    quote_job_total_cents
  )
  returning id into new_booking_id;

  insert into public.owner_acknowledgments (booking_id, status)
  values (new_booking_id, case when status_to_insert = 'confirmed' then 'needs_ack' else 'approval_needed' end);

  insert into public.status_events (booking_id, event_type, status)
  values (new_booking_id, case when status_to_insert = 'confirmed' then 'booking_confirmed' else 'booking_requested' end, status_to_insert::text);

  insert into public.payment_placeholders (
    booking_id, provider, mode, application_fee_amount_cents, amount_cents,
    deposit_cents, card_processing_fee_cents, routing_status, live_mode,
    payment_choice, quoted_job_total_cents, quoted_amount_before_card_fee_cents,
    quoted_due_today_cents, balance_due_cents, no_real_payment_collected
  )
  values (
    new_booking_id, 'stripe', 'test_mode_ready_not_connected', app_fee_cents, 0,
    public.setting_number('deposit_cents', 2500)::integer, quote_card_processing_fee_cents, 'ledger_only', false,
    quote_payment_choice, quote_job_total_cents, quote_amount_before_card_fee_cents,
    quote_due_today_cents, quote_balance_due_cents, true
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
    'short_notice_request', short_notice,
    'payment_choice', quote_payment_choice,
    'quoted_due_today_cents', quote_due_today_cents,
    'no_real_payment_collected', true
  );
end;
$$;

revoke all on function public.create_guest_booking(jsonb) from public;
grant execute on function public.create_guest_booking(jsonb) to anon, authenticated;
