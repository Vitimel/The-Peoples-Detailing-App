-- Role-gated owner reporting reads for the future Supabase cutover.
-- This gives Dane/Tim a business/tax summary without requiring the frontend to
-- stitch raw payment, ledger, SMS, and booking tables together.

create index if not exists bookings_start_status_idx
  on public.bookings (start_at, status);

create index if not exists payment_placeholders_booking_idx
  on public.payment_placeholders (booking_id);

create index if not exists app_fee_ledger_entries_booking_idx
  on public.app_fee_ledger_entries (booking_id);

create or replace function public.owner_get_report_snapshot(
  from_at_input timestamptz default null,
  to_at_input timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  range_start timestamptz := coalesce(from_at_input, date_trunc('month', now()));
  range_end timestamptz := coalesce(to_at_input, date_trunc('month', now()) + interval '1 month');
  summary jsonb;
  rows jsonb;
begin
  perform public.assert_owner_or_developer();

  if range_end <= range_start then
    raise exception 'report end must be after report start';
  end if;

  if range_end > range_start + interval '370 days' then
    raise exception 'report range cannot exceed 370 days';
  end if;

  with report_rows as (
    select
      b.id,
      b.service_title,
      b.start_at,
      b.completed_at,
      b.status,
      b.payment_status,
      b.cancellation_outcome,
      b.price_cents,
      b.travel_fee_cents,
      b.discount_cents,
      b.total_cents,
      coalesce(p.amount_cents, 0) as online_paid_cents,
      coalesce(p.deposit_cents, 0) as deposit_cents,
      coalesce(p.card_processing_fee_cents, 0) as card_processing_fee_cents,
      coalesce(l.gross_app_fee_cents, 0) as app_fee_cents,
      coalesce(l.sms_estimate_cents, 0) as sms_estimate_cents,
      coalesce(l.net_brandnew_estimate_cents, 0) as brandnew_net_estimate_cents,
      coalesce(l.routing_status::text, 'ledger_only') as app_fee_routing_status,
      coalesce(l.sms_cost_status, 'estimated_not_billed') as sms_cost_status,
      case
        when b.payment_status = 'cancelled_deposit_forfeited' then coalesce(p.deposit_cents, 0)
        else 0
      end as forfeited_deposit_cents,
      greatest(0, b.total_cents - coalesce(p.amount_cents, 0)) as balance_due_cents
    from public.bookings b
    left join lateral (
      select *
      from public.payment_placeholders payment
      where payment.booking_id = b.id
      order by payment.created_at desc
      limit 1
    ) p on true
    left join lateral (
      select *
      from public.app_fee_ledger_entries ledger
      where ledger.booking_id = b.id
      order by ledger.created_at desc
      limit 1
    ) l on true
    where b.start_at >= range_start
      and b.start_at < range_end
  )
  select
    jsonb_build_object(
      'booking_count', count(*),
      'completed_count', count(*) filter (where status = 'complete'),
      'requested_count', count(*) filter (where status = 'requested'),
      'cancelled_count', count(*) filter (where status = 'cancelled'),
      'gross_job_total_cents', coalesce(sum(total_cents), 0),
      'online_paid_cents', coalesce(sum(online_paid_cents), 0),
      'cash_balance_due_cents', coalesce(sum(balance_due_cents) filter (where status in ('confirmed', 'complete')), 0),
      'card_processing_fee_cents', coalesce(sum(card_processing_fee_cents), 0),
      'app_fee_cents', coalesce(sum(app_fee_cents), 0),
      'sms_estimate_cents', coalesce(sum(sms_estimate_cents), 0),
      'brandnew_net_estimate_cents', coalesce(sum(brandnew_net_estimate_cents), 0),
      'forfeited_deposit_cents', coalesce(sum(forfeited_deposit_cents), 0),
      'refund_needed_cents', 0,
      'routing_status', 'ledger_only',
      'sms_cost_status', 'estimated_not_billed'
    ),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'booking_id', id,
        'service_title', service_title,
        'start_at', start_at,
        'completed_at', completed_at,
        'status', status,
        'payment_status', payment_status,
        'cancellation_outcome', cancellation_outcome,
        'price_cents', price_cents,
        'travel_fee_cents', travel_fee_cents,
        'discount_cents', discount_cents,
        'total_cents', total_cents,
        'online_paid_cents', online_paid_cents,
        'deposit_cents', deposit_cents,
        'cash_balance_due_cents', balance_due_cents,
        'card_processing_fee_cents', card_processing_fee_cents,
        'app_fee_cents', app_fee_cents,
        'sms_estimate_cents', sms_estimate_cents,
        'brandnew_net_estimate_cents', brandnew_net_estimate_cents,
        'app_fee_routing_status', app_fee_routing_status,
        'sms_cost_status', sms_cost_status,
        'forfeited_deposit_cents', forfeited_deposit_cents
      )
      order by start_at asc
    ), '[]'::jsonb)
  into summary, rows
  from report_rows;

  return jsonb_build_object(
    'from_at', range_start,
    'to_at', range_end,
    'summary', coalesce(summary, '{}'::jsonb),
    'rows', coalesce(rows, '[]'::jsonb),
    'notes', jsonb_build_object(
      'app_fee_visibility', 'hidden_from_customer',
      'app_fee_routing_status', 'ledger_only',
      'sms_cost_status', 'estimated_not_billed',
      'live_payments', 'not_connected'
    )
  );
end;
$$;

revoke all on function public.owner_get_report_snapshot(timestamptz, timestamptz) from public;
grant execute on function public.owner_get_report_snapshot(timestamptz, timestamptz) to authenticated;
