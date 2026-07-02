-- Owner closeout RPC for the future Supabase cutover.
-- This records the job-completion money review server-side without attempting
-- Stripe refunds, captures, transfers, or any paid-provider calls.

alter table public.bookings
  add column if not exists closeout_status text,
  add column if not exists owner_adjustment_cents integer not null default 0,
  add column if not exists owner_adjustment_label text,
  add column if not exists adjusted_job_total_cents integer,
  add column if not exists cash_collected_cents integer not null default 0,
  add column if not exists original_balance_due_cents integer,
  add column if not exists balance_due_cents integer,
  add column if not exists refund_needed_cents integer not null default 0,
  add column if not exists closeout_note text,
  add column if not exists closed_out_by uuid references auth.users(id) on delete set null,
  add column if not exists closed_out_at timestamptz;

create index if not exists bookings_closeout_status_idx
  on public.bookings (closeout_status);

create or replace function public.owner_closeout_booking(
  booking_id_input uuid,
  owner_adjustment_cents_input integer default 0,
  owner_adjustment_label_input text default null,
  cash_collected_cents_input integer default 0,
  closeout_note_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
  payment_row public.payment_placeholders%rowtype;
  clean_adjustment_cents integer := greatest(0, coalesce(owner_adjustment_cents_input, 0));
  clean_cash_collected_cents integer := greatest(0, coalesce(cash_collected_cents_input, 0));
  paid_online_cents integer := 0;
  adjusted_total_cents integer := 0;
  max_cash_collectable_cents integer := 0;
  applied_cash_collected_cents integer := 0;
  remaining_balance_cents integer := 0;
  refund_needed_cents integer := 0;
  closeout_status_result text;
  payment_status_result text;
begin
  perform public.assert_owner_or_developer();

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status not in ('confirmed', 'complete') then
    raise exception 'only confirmed or complete bookings can be closed out';
  end if;

  select * into payment_row
  from public.payment_placeholders
  where booking_id = booking_id_input
  order by created_at desc
  limit 1;

  paid_online_cents := coalesce(payment_row.amount_cents, 0);
  adjusted_total_cents := greatest(0, coalesce(booking_row.total_cents, 0) - clean_adjustment_cents);
  max_cash_collectable_cents := greatest(0, adjusted_total_cents - paid_online_cents);
  applied_cash_collected_cents := least(clean_cash_collected_cents, max_cash_collectable_cents);
  remaining_balance_cents := greatest(0, adjusted_total_cents - paid_online_cents - applied_cash_collected_cents);
  refund_needed_cents := greatest(0, paid_online_cents - adjusted_total_cents);
  closeout_status_result := case
    when refund_needed_cents > 0 then 'refund_needed'
    when remaining_balance_cents > 0 then 'balance_due'
    else 'closed'
  end;
  payment_status_result := case
    when refund_needed_cents > 0 then 'refund_needed'
    when remaining_balance_cents > 0 then 'balance_due'
    else 'complete'
  end;

  update public.bookings
  set status = 'complete',
      tracker_status = 'complete',
      completed_at = coalesce(completed_at, now()),
      closeout_status = closeout_status_result,
      owner_adjustment_cents = clean_adjustment_cents,
      owner_adjustment_label = nullif(trim(coalesce(owner_adjustment_label_input, '')), ''),
      adjusted_job_total_cents = adjusted_total_cents,
      cash_collected_cents = applied_cash_collected_cents,
      original_balance_due_cents = coalesce(booking_row.original_balance_due_cents, booking_row.balance_due_cents, greatest(0, coalesce(booking_row.total_cents, 0) - paid_online_cents)),
      balance_due_cents = remaining_balance_cents,
      refund_needed_cents = refund_needed_cents,
      payment_status = payment_status_result,
      closeout_note = nullif(trim(coalesce(closeout_note_input, '')), ''),
      closed_out_by = auth.uid(),
      closed_out_at = now(),
      updated_at = now()
  where id = booking_id_input;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input, 'owner_closed_out_booking', closeout_status_result, auth.uid()
  );

  return jsonb_build_object(
    'booking_id', booking_id_input,
    'status', 'complete',
    'tracker_status', 'complete',
    'closeout_status', closeout_status_result,
    'owner_adjustment_cents', clean_adjustment_cents,
    'owner_adjustment_label', nullif(trim(coalesce(owner_adjustment_label_input, '')), ''),
    'adjusted_job_total_cents', adjusted_total_cents,
    'cash_collected_cents', applied_cash_collected_cents,
    'balance_due_cents', remaining_balance_cents,
    'refund_needed_cents', refund_needed_cents,
    'payment_status', payment_status_result,
    'live_refund_status', case when refund_needed_cents > 0 then 'manual_review_required_no_stripe_refund_sent' else 'not_needed' end
  );
end;
$$;

revoke all on function public.owner_closeout_booking(uuid, integer, text, integer, text) from public;
grant execute on function public.owner_closeout_booking(uuid, integer, text, integer, text) to authenticated;

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
      coalesce(b.adjusted_job_total_cents, b.total_cents) as adjusted_job_total_cents,
      coalesce(b.owner_adjustment_cents, 0) as owner_adjustment_cents,
      b.owner_adjustment_label,
      coalesce(b.cash_collected_cents, 0) as cash_collected_cents,
      coalesce(b.refund_needed_cents, 0) as refund_needed_cents,
      b.closeout_status,
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
      coalesce(b.balance_due_cents, greatest(0, coalesce(b.adjusted_job_total_cents, b.total_cents) - coalesce(p.amount_cents, 0) - coalesce(b.cash_collected_cents, 0))) as balance_due_cents
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
      'adjusted_job_total_cents', coalesce(sum(adjusted_job_total_cents), 0),
      'online_paid_cents', coalesce(sum(online_paid_cents), 0),
      'cash_collected_cents', coalesce(sum(cash_collected_cents), 0),
      'cash_balance_due_cents', coalesce(sum(balance_due_cents) filter (where status in ('confirmed', 'complete')), 0),
      'owner_adjustment_cents', coalesce(sum(owner_adjustment_cents), 0),
      'card_processing_fee_cents', coalesce(sum(card_processing_fee_cents), 0),
      'app_fee_cents', coalesce(sum(app_fee_cents), 0),
      'sms_estimate_cents', coalesce(sum(sms_estimate_cents), 0),
      'brandnew_net_estimate_cents', coalesce(sum(brandnew_net_estimate_cents), 0),
      'forfeited_deposit_cents', coalesce(sum(forfeited_deposit_cents), 0),
      'refund_needed_cents', coalesce(sum(refund_needed_cents), 0),
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
        'adjusted_job_total_cents', adjusted_job_total_cents,
        'owner_adjustment_cents', owner_adjustment_cents,
        'owner_adjustment_label', owner_adjustment_label,
        'online_paid_cents', online_paid_cents,
        'deposit_cents', deposit_cents,
        'cash_collected_cents', cash_collected_cents,
        'cash_balance_due_cents', balance_due_cents,
        'refund_needed_cents', refund_needed_cents,
        'closeout_status', closeout_status,
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
      'live_payments', 'not_connected',
      'live_refunds', 'not_connected'
    )
  );
end;
$$;
