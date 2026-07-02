-- The Peoples Detailing Supabase live smoke checks
-- Run after applying every migration and supabase/seed.sql to a new Supabase
-- Free project. These checks are intentionally no-cost and do not call Stripe,
-- SMS, maps, or other paid providers.
--
-- Important: this file verifies schema, seed data, RPC presence, and several
-- direct database invariants. Supabase RLS must still be verified through anon
-- and authenticated API calls because the SQL Editor can run with elevated
-- privileges.

begin;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (
    values
      ('profiles'),
      ('customer_profiles'),
      ('services'),
      ('vehicles'),
      ('bookings'),
      ('availability_blocks'),
      ('messages'),
      ('owner_acknowledgments'),
      ('status_events'),
      ('payment_placeholders'),
      ('app_fee_ledger_entries'),
      ('sms_notifications'),
      ('integration_status'),
      ('business_settings')
  ) as expected(table_name)
  where not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = expected.table_name
  );

  if missing_count > 0 then
    raise exception 'Missing % expected public tables', missing_count;
  end if;
end $$;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (
    values
      ('create_guest_booking'),
      ('claim_guest_booking'),
      ('owner_acknowledge_booking'),
      ('owner_decide_booking_request'),
      ('owner_request_booking_reschedule'),
      ('owner_update_booking_tracker'),
      ('owner_set_availability_block'),
      ('owner_remove_availability_block'),
      ('customer_cancel_booking'),
      ('reschedule_booking'),
      ('create_booking_message'),
      ('developer_update_service'),
      ('developer_update_business_setting'),
      ('developer_update_integration_status'),
      ('developer_assign_app_role'),
      ('get_customer_booking'),
      ('get_customer_booking_messages'),
      ('current_app_role'),
      ('is_owner_or_developer')
  ) as expected(function_name)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = expected.function_name
  );

  if missing_count > 0 then
    raise exception 'Missing % expected public functions/RPCs', missing_count;
  end if;
end $$;

do $$
declare
  unprotected_count integer;
begin
  select count(*) into unprotected_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'profiles',
      'customer_profiles',
      'services',
      'vehicles',
      'bookings',
      'availability_blocks',
      'messages',
      'owner_acknowledgments',
      'status_events',
      'payment_placeholders',
      'app_fee_ledger_entries',
      'sms_notifications',
      'integration_status',
      'business_settings'
    )
    and not c.relrowsecurity;

  if unprotected_count > 0 then
    raise exception '% expected public tables do not have RLS enabled', unprotected_count;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.bookings'::regclass
      and attname = 'end_at'
      and not attisdropped
  ) then
    raise exception 'bookings.end_at is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.bookings'::regclass
      and tgname = 'set_booking_end_at_before_write'
      and not tgisinternal
  ) then
    raise exception 'booking end_at trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_active_overlap'
  ) then
    raise exception 'active booking overlap exclusion constraint is missing';
  end if;
end $$;

do $$
declare
  basic_price integer;
  app_fee jsonb;
  sms_provider jsonb;
  stripe_live jsonb;
begin
  select price_cents into basic_price from public.services where id = 'basic';
  if basic_price is distinct from 15000 then
    raise exception 'Expected Basic Detail seed price to be 15000 cents, got %', basic_price;
  end if;

  select value into app_fee from public.business_settings where key = 'company_app_fee_cents';
  if app_fee is distinct from '300'::jsonb then
    raise exception 'Expected hidden BrandNew app fee seed to be 300 cents, got %', app_fee;
  end if;

  select value into sms_provider from public.business_settings where key = 'sms_provider';
  if sms_provider is distinct from '"not_connected"'::jsonb then
    raise exception 'Expected SMS provider to stay not_connected, got %', sms_provider;
  end if;

  select value into stripe_live from public.business_settings where key = 'stripe_live_mode';
  if stripe_live is distinct from '"locked"'::jsonb then
    raise exception 'Expected Stripe live mode to stay locked, got %', stripe_live;
  end if;
end $$;

do $$
declare
  smoke_booking_id uuid;
  smoke_booking_result jsonb;
  owner_sms_count integer;
  app_fee_visible boolean;
  payment_live boolean;
begin
  smoke_booking_result := public.create_guest_booking(jsonb_build_object(
    'service_id', 'basic',
    'start_at', ('2035-06-02 10:00 America/Chicago')::timestamptz::text,
    'time_label', '10:00 AM',
    'address', '218 Demo Ave, Murfreesboro, TN',
    'guest_name', 'Backend Smoke Test',
    'guest_phone', '(615) 555-0100',
    'guest_vehicle_label', 'Smoke test vehicle',
    'travel_fee_cents', 0
  ));
  smoke_booking_id := (smoke_booking_result->>'booking_id')::uuid;

  if smoke_booking_id is null then
    raise exception 'create_guest_booking returned null';
  end if;

  if nullif(smoke_booking_result->>'claim_token', '') is null then
    raise exception 'create_guest_booking did not return a guest claim token';
  end if;

  if (public.get_customer_booking(smoke_booking_id, smoke_booking_result->>'claim_token')->>'id')::uuid is distinct from smoke_booking_id then
    raise exception 'guest claim token could not read safe customer booking';
  end if;

  if jsonb_typeof(public.get_customer_booking_messages(smoke_booking_id, smoke_booking_result->>'claim_token')) <> 'array' then
    raise exception 'guest claim token could not read safe customer messages array';
  end if;

  if not exists (
    select 1 from public.bookings
    where id = smoke_booking_id
      and status = 'confirmed'
      and owner_ack_status = 'needs_ack'
      and short_notice_request = false
  ) then
    raise exception 'Normal future booking did not create confirmed/needs_ack booking';
  end if;

  select count(*) into owner_sms_count
  from public.sms_notifications
  where booking_id = smoke_booking_id
    and audience = 'owner'
    and provider = 'not_connected'
    and status = 'would_send'
    and cost_status = 'estimated_not_billed';

  if owner_sms_count <> 1 then
    raise exception 'Expected one owner SMS placeholder, got %', owner_sms_count;
  end if;

  select visible_to_customer into app_fee_visible
  from public.app_fee_ledger_entries
  where booking_id = smoke_booking_id;

  if app_fee_visible is distinct from false then
    raise exception 'Hidden app-fee ledger entry became customer-visible';
  end if;

  select live_mode into payment_live
  from public.payment_placeholders
  where booking_id = smoke_booking_id;

  if payment_live is distinct from false then
    raise exception 'Payment placeholder unexpectedly marked live';
  end if;
end $$;

do $$
declare
  short_notice_id uuid;
  short_notice_result jsonb;
begin
  update public.business_settings
  set value = '999999'::jsonb
  where key = 'minimum_booking_notice_hours';

  short_notice_result := public.create_guest_booking(jsonb_build_object(
    'service_id', 'basic',
    'start_at', ('2035-06-03 10:00 America/Chicago')::timestamptz::text,
    'time_label', '10:00 AM',
    'address', '218 Demo Ave, Murfreesboro, TN',
    'guest_name', 'Short Notice Smoke Test',
    'guest_phone', '(615) 555-0101',
    'guest_vehicle_label', 'Smoke test vehicle',
    'travel_fee_cents', 0
  ));
  short_notice_id := (short_notice_result->>'booking_id')::uuid;

  if nullif(short_notice_result->>'claim_token', '') is null then
    raise exception 'short-notice booking did not return a guest claim token';
  end if;

  if not exists (
    select 1 from public.bookings
    where id = short_notice_id
      and status = 'requested'
      and owner_ack_status = 'approval_needed'
      and short_notice_request = true
  ) then
    raise exception 'Short-notice booking did not become requested/approval_needed';
  end if;
end $$;

-- The smoke records above were only validation data.
rollback;
