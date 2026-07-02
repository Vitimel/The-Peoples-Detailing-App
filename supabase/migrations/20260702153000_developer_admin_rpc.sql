-- Repo-ready developer admin RPCs. These support pricing, money settings,
-- and integration readiness while keeping live providers locked.

create or replace function public.assert_developer()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_app_role() <> 'developer' then
    raise exception 'developer role required';
  end if;
end;
$$;

create or replace function public.developer_update_service(
  service_id_input text,
  title_input text,
  price_cents_input integer,
  duration_minutes_input integer,
  buffer_minutes_input integer default 30,
  visible_input boolean default true
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_service_id text := trim(coalesce(service_id_input, ''));
  clean_title text := trim(coalesce(title_input, ''));
begin
  perform public.assert_developer();

  if clean_service_id = '' then
    raise exception 'service id is required';
  end if;

  if clean_title = '' then
    raise exception 'service title is required';
  end if;

  if price_cents_input is null or price_cents_input < 0 then
    raise exception 'price_cents must be zero or greater';
  end if;

  if duration_minutes_input is null or duration_minutes_input < 30 then
    raise exception 'duration_minutes must be at least 30';
  end if;

  if buffer_minutes_input is null or buffer_minutes_input < 0 then
    raise exception 'buffer_minutes must be zero or greater';
  end if;

  insert into public.services (
    id, title, price_cents, duration_hours, duration_minutes, buffer_minutes, visible
  )
  values (
    clean_service_id,
    clean_title,
    price_cents_input,
    duration_minutes_input / 60.0,
    duration_minutes_input,
    buffer_minutes_input,
    coalesce(visible_input, true)
  )
  on conflict (id) do update set
    title = excluded.title,
    price_cents = excluded.price_cents,
    duration_hours = excluded.duration_hours,
    duration_minutes = excluded.duration_minutes,
    buffer_minutes = excluded.buffer_minutes,
    visible = excluded.visible,
    updated_at = now();

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    null, 'developer_service_updated', clean_service_id, auth.uid()
  );

  return clean_service_id;
end;
$$;

create or replace function public.developer_update_business_setting(
  setting_key_input text,
  setting_value_input jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_key text := lower(trim(coalesce(setting_key_input, '')));
  numeric_value numeric;
  text_value text;
begin
  perform public.assert_developer();

  if clean_key not in (
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
  ) then
    raise exception 'setting cannot be managed by developer admin';
  end if;

  if clean_key in (
    'deposit_cents',
    'company_app_fee_cents',
    'card_processing_percent',
    'card_processing_fixed_cents',
    'owner_sms_estimate_cents'
  ) then
    numeric_value := (setting_value_input #>> '{}')::numeric;
    if numeric_value < 0 then
      raise exception 'numeric setting must be zero or greater';
    end if;
  end if;

  if clean_key = 'booking_submit_mode' then
    text_value := setting_value_input #>> '{}';
    if text_value not in ('instant_book_no_payment', 'request_only', 'demo_card') then
      raise exception 'booking submit mode is not supported';
    end if;
  end if;

  if clean_key = 'stripe_live_mode' and setting_value_input <> '"locked"'::jsonb then
    raise exception 'Stripe live mode remains locked until separate go-live approval';
  end if;

  if clean_key = 'sms_provider' and setting_value_input <> '"not_connected"'::jsonb then
    raise exception 'SMS provider remains not_connected until separate go-live approval';
  end if;

  insert into public.business_settings (key, value)
  values (clean_key, setting_value_input)
  on conflict (key) do update set
    value = excluded.value,
    updated_at = now();

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    null, 'developer_business_setting_updated', clean_key, auth.uid()
  );

  return clean_key;
end;
$$;

create or replace function public.developer_update_integration_status(
  integration_id_input text,
  status_input text,
  details_input text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_id text := lower(trim(coalesce(integration_id_input, '')));
  clean_status text := lower(trim(coalesce(status_input, '')));
begin
  perform public.assert_developer();

  if clean_id not in (
    'frontend_host',
    'supabase_backend',
    'auth_rls',
    'stripe_test_mode',
    'stripe_live_mode',
    'owner_sms',
    'maps_address_tools',
    'google_calendar'
  ) then
    raise exception 'integration id is not supported';
  end if;

  if clean_id = 'stripe_live_mode' and clean_status <> 'locked' then
    raise exception 'Stripe live mode remains locked until separate go-live approval';
  end if;

  if clean_id = 'owner_sms' and clean_status not in ('queued_locally_only', 'planned_not_connected') then
    raise exception 'owner SMS provider remains disabled until separate approval';
  end if;

  if clean_status = '' then
    raise exception 'integration status is required';
  end if;

  insert into public.integration_status (id, status, details)
  values (
    clean_id,
    clean_status,
    nullif(trim(coalesce(details_input, '')), '')
  )
  on conflict (id) do update set
    status = excluded.status,
    details = excluded.details,
    updated_at = now();

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    null, 'developer_integration_status_updated', clean_id || ':' || clean_status, auth.uid()
  );

  return clean_id;
end;
$$;

revoke all on function public.assert_developer() from public;
revoke all on function public.developer_update_service(text, text, integer, integer, integer, boolean) from public;
revoke all on function public.developer_update_business_setting(text, jsonb) from public;
revoke all on function public.developer_update_integration_status(text, text, text) from public;

grant execute on function public.developer_update_service(text, text, integer, integer, integer, boolean) to authenticated;
grant execute on function public.developer_update_business_setting(text, jsonb) to authenticated;
grant execute on function public.developer_update_integration_status(text, text, text) to authenticated;
