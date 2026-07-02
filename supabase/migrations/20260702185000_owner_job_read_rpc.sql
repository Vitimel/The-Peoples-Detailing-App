-- Role-gated owner job queue reads for the future Supabase cutover.
-- Dane needs a reliable operational job list without stitching raw tables
-- together in the frontend. Developer/payment internals remain separate.

create or replace function public.owner_list_jobs(
  from_at_input timestamptz default null,
  to_at_input timestamptz default null,
  status_filter_input text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_owner_or_developer();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'service_id', b.service_id,
        'service_title', b.service_title,
        'price_cents', b.price_cents,
        'start_at', b.start_at,
        'end_at', b.end_at,
        'address', b.address,
        'lat', b.lat,
        'lng', b.lng,
        'travel_miles', b.travel_miles,
        'travel_fee_cents', b.travel_fee_cents,
        'discount_cents', b.discount_cents,
        'total_cents', b.total_cents,
        'status', b.status,
        'short_notice_request', b.short_notice_request,
        'owner_ack_status', b.owner_ack_status,
        'tracker_status', b.tracker_status,
        'last_tracker_at', b.last_tracker_at,
        'guest_name', b.guest_name,
        'guest_phone', b.guest_phone,
        'guest_vehicle_label', b.guest_vehicle_label,
        'customer_access_mode', case when b.claimed_at is null then 'guest' else 'profile' end,
        'claimed_at', b.claimed_at,
        'confirmed_at', b.confirmed_at,
        'declined_at', b.declined_at,
        'reschedule_requested_at', b.reschedule_requested_at,
        'cancelled_at', b.cancelled_at,
        'completed_at', b.completed_at,
        'payment_status', b.payment_status,
        'cancellation_outcome', b.cancellation_outcome,
        'message_count', coalesce(msg.message_count, 0),
        'owner_sms_status', sms.last_owner_sms_status,
        'owner_sms_cost_status', sms.last_owner_sms_cost_status,
        'created_at', b.created_at,
        'updated_at', b.updated_at
      )
      order by b.start_at asc
    )
    from public.bookings b
    left join lateral (
      select count(*)::integer as message_count
      from public.messages m
      where m.booking_id = b.id
    ) msg on true
    left join lateral (
      select
        s.status::text as last_owner_sms_status,
        s.cost_status as last_owner_sms_cost_status
      from public.sms_notifications s
      where s.booking_id = b.id
        and s.audience = 'owner'
      order by s.created_at desc
      limit 1
    ) sms on true
    where b.start_at >= coalesce(from_at_input, now() - interval '30 days')
      and b.start_at < coalesce(to_at_input, now() + interval '90 days')
      and (
        nullif(status_filter_input, '') is null
        or b.status::text = status_filter_input
        or b.owner_ack_status = status_filter_input
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.owner_list_jobs(timestamptz, timestamptz, text) from public;
grant execute on function public.owner_list_jobs(timestamptz, timestamptz, text) to authenticated;
