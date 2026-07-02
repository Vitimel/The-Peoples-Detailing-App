-- Role-gated owner notification reads for the future Supabase cutover.
-- This exposes the "SMS would be sent" queue as an owner inbox without
-- sending real SMS or leaking payment/app-fee internals.

create index if not exists sms_notifications_owner_created_idx
  on public.sms_notifications (audience, created_at desc);

create or replace function public.owner_list_notifications(
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
        'id', s.id,
        'booking_id', b.id,
        'notification_type', 'owner_sms_placeholder',
        'audience', s.audience,
        'provider', s.provider,
        'status', s.status,
        'cost_estimate_cents', s.cost_estimate_cents,
        'cost_status', s.cost_status,
        'body_preview', s.body_preview,
        'sent_at', s.sent_at,
        'created_at', s.created_at,
        'action_required', (
          b.status = 'requested'
          or b.owner_ack_status in ('needs_ack', 'approval_needed')
          or coalesce(latest_message.direction, '') = 'customer_to_owner'
        ),
        'booking', jsonb_build_object(
          'id', b.id,
          'service_id', b.service_id,
          'service_title', b.service_title,
          'start_at', b.start_at,
          'end_at', b.end_at,
          'status', b.status,
          'short_notice_request', b.short_notice_request,
          'owner_ack_status', b.owner_ack_status,
          'guest_name', b.guest_name,
          'guest_phone', b.guest_phone,
          'guest_vehicle_label', b.guest_vehicle_label,
          'address', b.address
        )
      )
      order by s.created_at desc
    )
    from public.sms_notifications s
    join public.bookings b on b.id = s.booking_id
    left join lateral (
      select m.direction
      from public.messages m
      where m.booking_id = b.id
      order by m.created_at desc
      limit 1
    ) latest_message on true
    where s.audience = 'owner'
      and s.created_at >= coalesce(from_at_input, now() - interval '30 days')
      and s.created_at < coalesce(to_at_input, now() + interval '90 days')
      and (
        nullif(status_filter_input, '') is null
        or s.status::text = status_filter_input
        or b.status::text = status_filter_input
        or b.owner_ack_status = status_filter_input
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.owner_list_notifications(timestamptz, timestamptz, text) from public;
grant execute on function public.owner_list_notifications(timestamptz, timestamptz, text) to authenticated;
