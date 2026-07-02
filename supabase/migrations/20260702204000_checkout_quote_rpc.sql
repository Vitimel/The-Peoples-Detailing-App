-- Customer-safe checkout quote RPC for the future Supabase cutover.
-- This keeps checkout math server-owned without collecting real money or
-- exposing BrandNew's hidden app-fee ledger amount to customers.

create or replace function public.get_checkout_quote(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  service_row public.services%rowtype;
  payment_choice text := coalesce(nullif(trim(payload->>'payment_choice'), ''), 'deposit_cash_balance');
  travel_fee_cents integer := greatest(0, coalesce(nullif(payload->>'travel_fee_cents', '')::integer, 0));
  discount_cents integer := greatest(0, coalesce(nullif(payload->>'discount_cents', '')::integer, 0));
  subtotal_cents integer;
  job_total_cents integer;
  deposit_cents integer := public.setting_number('deposit_cents', 2500)::integer;
  customer_pays_card_fee boolean := coalesce((select (value #>> '{}')::boolean from public.business_settings where key = 'customer_pays_card_processing_fee'), true);
  card_percent numeric := public.setting_number('card_processing_percent', 2.9);
  card_fixed_cents integer := public.setting_number('card_processing_fixed_cents', 30)::integer;
  amount_before_card_fee integer := 0;
  card_processing_fee_cents integer := 0;
  due_today_cents integer := 0;
  balance_due_cents integer := 0;
  payment_status text;
begin
  if coalesce(payload->>'service_id', '') = '' then
    raise exception 'service_id is required';
  end if;

  if payment_choice not in ('card_full', 'deposit_cash_balance', 'pay_later') then
    raise exception 'payment_choice must be card_full, deposit_cash_balance, or pay_later';
  end if;

  select * into service_row
  from public.services
  where id = payload->>'service_id'
    and visible = true;

  if not found then
    raise exception 'service is not available';
  end if;

  subtotal_cents := service_row.price_cents + travel_fee_cents;
  job_total_cents := greatest(0, subtotal_cents - discount_cents);

  amount_before_card_fee := case
    when payment_choice = 'card_full' then job_total_cents
    when payment_choice = 'deposit_cash_balance' then least(greatest(0, deposit_cents), job_total_cents)
    else 0
  end;

  card_processing_fee_cents := case
    when amount_before_card_fee > 0 and customer_pays_card_fee then
      greatest(0, round(((amount_before_card_fee + card_fixed_cents) / (1 - card_percent / 100.0)) - amount_before_card_fee)::integer)
    else 0
  end;

  due_today_cents := amount_before_card_fee + card_processing_fee_cents;
  balance_due_cents := greatest(0, job_total_cents - amount_before_card_fee);
  payment_status := case
    when payment_choice = 'card_full' then 'paid_full'
    when payment_choice = 'deposit_cash_balance' then 'balance_due'
    else 'not_collected'
  end;

  return jsonb_build_object(
    'service_id', service_row.id,
    'service_title', service_row.title,
    'service_price_cents', service_row.price_cents,
    'travel_fee_cents', travel_fee_cents,
    'discount_cents', discount_cents,
    'subtotal_cents', subtotal_cents,
    'job_total_cents', job_total_cents,
    'payment_choice', payment_choice,
    'amount_paid_before_card_fee_cents', amount_before_card_fee,
    'card_processing_fee_cents', card_processing_fee_cents,
    'total_due_today_cents', due_today_cents,
    'balance_due_cents', balance_due_cents,
    'payment_status', payment_status,
    'customer_pays_card_processing_fee', customer_pays_card_fee,
    'card_processing_percent', card_percent,
    'card_processing_fixed_cents', card_fixed_cents,
    'app_fee_visible_to_customer', false,
    'app_fee_routing_status', 'ledger_only',
    'live_payment_status', 'not_connected',
    'no_real_payment_collected', true
  );
end;
$$;

revoke all on function public.get_checkout_quote(jsonb) from public;
grant execute on function public.get_checkout_quote(jsonb) to anon, authenticated;
