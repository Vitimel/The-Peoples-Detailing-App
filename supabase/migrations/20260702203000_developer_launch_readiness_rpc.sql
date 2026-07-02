-- Developer-only launch readiness snapshot for the future Supabase cutover.
-- This is a no-cost safety gate: it reads schema, RPC, seed, and lock status,
-- but it does not inspect customer bookings or call live providers.

create or replace function public.developer_get_launch_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  expected_tables text[] := array[
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
  ];
  expected_functions text[] := array[
    'create_guest_booking',
    'get_checkout_quote',
    'claim_guest_booking',
    'get_customer_booking',
    'get_customer_booking_messages',
    'get_booking_timeline',
    'get_customer_bookings',
    'get_my_customer_profile',
    'upsert_my_customer_profile',
    'upsert_my_vehicle',
    'delete_my_vehicle',
    'get_public_availability',
    'owner_list_jobs',
    'owner_list_notifications',
    'owner_get_report_snapshot',
    'owner_closeout_booking',
    'owner_acknowledge_booking',
    'owner_decide_booking_request',
    'owner_request_booking_reschedule',
    'owner_update_booking_tracker',
    'owner_set_availability_block',
    'owner_remove_availability_block',
    'customer_cancel_booking',
    'reschedule_booking',
    'create_booking_message',
    'developer_get_admin_snapshot',
    'developer_get_launch_readiness',
    'developer_update_service',
    'developer_update_business_setting',
    'developer_update_integration_status',
    'developer_assign_app_role'
  ];
  missing_tables jsonb;
  missing_functions jsonb;
  unprotected_tables jsonb;
  integration_json jsonb;
  settings_json jsonb;
  stripe_live text;
  sms_provider text;
begin
  perform public.assert_developer();

  select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
  into missing_tables
  from unnest(expected_tables) expected(table_name)
  where not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = expected.table_name
  );

  select coalesce(jsonb_agg(function_name order by function_name), '[]'::jsonb)
  into missing_functions
  from unnest(expected_functions) expected(function_name)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = expected.function_name
  );

  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
  into unprotected_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any(expected_tables)
    and not c.relrowsecurity;

  select coalesce(jsonb_object_agg(i.id, i.status), '{}'::jsonb)
  into integration_json
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

  select coalesce(jsonb_object_agg(bs.key, bs.value), '{}'::jsonb)
  into settings_json
  from public.business_settings bs
  where bs.key in (
    'booking_submit_mode',
    'company_app_fee_cents',
    'customer_pays_card_processing_fee',
    'stripe_live_mode',
    'sms_provider'
  );

  stripe_live := coalesce(settings_json->>'stripe_live_mode', 'locked');
  sms_provider := coalesce(settings_json->>'sms_provider', 'not_connected');

  return jsonb_build_object(
    'status', case
      when jsonb_array_length(missing_tables) = 0
        and jsonb_array_length(missing_functions) = 0
        and jsonb_array_length(unprotected_tables) = 0
        and stripe_live = 'locked'
        and sms_provider = 'not_connected'
      then 'repo_ready_requires_live_verification'
      else 'needs_attention'
    end,
    'free_path', true,
    'missing_tables', missing_tables,
    'missing_functions', missing_functions,
    'unprotected_tables', unprotected_tables,
    'integration_status', integration_json,
    'business_locks', jsonb_build_object(
      'stripe_live_mode', stripe_live,
      'sms_provider', sms_provider,
      'customer_sees_app_fee', false,
      'app_fee_routing_status', 'ledger_only',
      'live_sms_sends', 'not_connected',
      'live_payment_charges', 'not_connected'
    ),
    'required_before_customer_data', jsonb_build_array(
      'apply_all_migrations',
      'run_supabase_seed',
      'bootstrap_first_developer',
      'run_live_smoke_checks',
      'run_api_rls_verifier',
      'keep_vite_use_supabase_false_until_verified'
    ),
    'notes', jsonb_build_object(
      'no_service_role_key_in_frontend', true,
      'no_live_stripe', true,
      'no_live_sms', true,
      'no_paid_maps', true
    )
  );
end;
$$;

revoke all on function public.developer_get_launch_readiness() from public;
grant execute on function public.developer_get_launch_readiness() to authenticated;
