-- Developer-only admin snapshot for pricing, money settings, and integration
-- readiness. This is read-only and does not expose customer bookings,
-- payment placeholders, SMS queue rows, or claim tokens.

create or replace function public.developer_get_admin_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  developer_setting_keys text[] := array[
    'booking_submit_mode',
    'deposit_cents',
    'company_app_fee_cents',
    'customer_pays_card_processing_fee',
    'card_processing_percent',
    'card_processing_fixed_cents',
    'card_processing_info_text',
    'owner_sms_estimate_cents',
    'stripe_live_mode',
    'sms_provider'
  ];
  services_json jsonb;
  settings_json jsonb;
  integrations_json jsonb;
begin
  perform public.assert_developer();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'price_cents', s.price_cents,
      'duration_hours', s.duration_hours,
      'duration_minutes', s.duration_minutes,
      'buffer_minutes', s.buffer_minutes,
      'visible', s.visible,
      'updated_at', s.updated_at
    )
    order by s.title
  ), '[]'::jsonb)
  into services_json
  from public.services s;

  select coalesce(jsonb_object_agg(bs.key, bs.value), '{}'::jsonb)
  into settings_json
  from public.business_settings bs
  where bs.key = any(developer_setting_keys);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'status', i.status,
      'details', i.details,
      'updated_at', i.updated_at
    )
    order by i.id
  ), '[]'::jsonb)
  into integrations_json
  from public.integration_status i
  where i.id in (
    'frontend_host',
    'supabase_backend',
    'auth_rls',
    'stripe_test_mode',
    'stripe_live_mode',
    'owner_sms',
    'maps_address_tools',
    'google_calendar'
  );

  return jsonb_build_object(
    'services', services_json,
    'developer_settings', settings_json,
    'integrations', integrations_json,
    'money_flow', jsonb_build_object(
      'customer_sees_app_fee', false,
      'app_fee_routing_status', 'ledger_only',
      'customer_card_processing_default', coalesce(settings_json->'customer_pays_card_processing_fee', 'true'::jsonb),
      'live_stripe_status', coalesce(settings_json->'stripe_live_mode', '"locked"'::jsonb),
      'sms_provider_status', coalesce(settings_json->'sms_provider', '"not_connected"'::jsonb)
    ),
    'live_mode_locks', jsonb_build_object(
      'stripe_live_mode', 'locked_until_explicit_approval',
      'sms_provider', 'not_connected_until_explicit_approval',
      'supabase_customer_data', 'requires_auth_rls_verification'
    )
  );
end;
$$;

revoke all on function public.developer_get_admin_snapshot() from public;
grant execute on function public.developer_get_admin_snapshot() to authenticated;
