-- The Peoples Detailing starter data for a fresh Supabase Free project.
-- Apply after migrations. Review with Dane before using for real customers.

insert into public.services (
  id,
  title,
  price_cents,
  duration_hours,
  duration_minutes,
  buffer_minutes,
  visible
) values
  ('basic', 'Basic Detail', 15000, 3, 180, 30, true),
  ('deluxe', 'Deluxe Detail', 22000, 5, 300, 30, true),
  ('premium', 'Premium Detail', 32000, 8, 480, 30, true),
  ('monthly', 'Monthly Maintenance', 10000, 2, 120, 30, true)
on conflict (id) do update set
  title = excluded.title,
  price_cents = excluded.price_cents,
  duration_hours = excluded.duration_hours,
  duration_minutes = excluded.duration_minutes,
  buffer_minutes = excluded.buffer_minutes,
  visible = excluded.visible,
  updated_at = now();

insert into public.business_settings (key, value) values
  ('business_name', '"The Peoples Detailing"'::jsonb),
  ('business_phone', '"(931) 334-0730"'::jsonb),
  ('base_address', '"Murfreesboro, TN"'::jsonb),
  ('working_hours_start', '8'::jsonb),
  ('working_hours_end', '19.5'::jsonb),
  ('minimum_booking_notice_hours', '48'::jsonb),
  ('reschedule_cutoff_hours', '48'::jsonb),
  ('cancel_deposit_forfeit_days', '7'::jsonb),
  ('free_travel_radius_miles', '10'::jsonb),
  ('per_mile_fee_cents', '150'::jsonb),
  ('company_app_fee_cents', '300'::jsonb),
  ('deposit_cents', '2500'::jsonb),
  ('customer_pays_card_processing_fee', 'true'::jsonb),
  ('card_processing_percent', '2.9'::jsonb),
  ('card_processing_fixed_cents', '30'::jsonb),
  ('card_processing_info_text', '"Card payments include the processing fee. Deposit plus cash balance is available if you prefer to pay the rest at service."'::jsonb),
  ('owner_sms_estimate_cents', '1'::jsonb),
  ('booking_submit_mode', '"instant_book_no_payment"'::jsonb),
  ('stripe_live_mode', '"locked"'::jsonb),
  ('sms_provider', '"not_connected"'::jsonb)
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

insert into public.integration_status (id, status, details) values
  ('frontend_host', 'github_pages_active', 'Static frontend remains on GitHub Pages.'),
  ('supabase_backend', 'repo_ready_not_live', 'Migrations and seed are ready; live project credentials are not configured.'),
  ('auth_rls', 'schema_ready_requires_verification', 'RLS is defined but must be verified before storing real customer data.'),
  ('stripe_test_mode', 'planned_not_connected', 'No Checkout Session, PaymentIntent, webhook, or live key is connected.'),
  ('stripe_live_mode', 'locked', 'Live payments require separate go-live approval.'),
  ('owner_sms', 'queued_locally_only', 'SMS provider calls are not enabled.'),
  ('maps_address_tools', 'planned_not_connected', 'Maps links and browser GPS pinning only; no paid Maps API, live routing, or reverse geocoding connected.'),
  ('google_calendar', 'planned_not_connected', 'Google Calendar sync is not connected.')
on conflict (id) do update set
  status = excluded.status,
  details = excluded.details,
  updated_at = now();
