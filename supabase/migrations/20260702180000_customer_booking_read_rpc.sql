-- Token-gated customer booking reads for the future Supabase cutover.
-- Direct table reads stay protected by RLS; these RPCs return only
-- customer-safe booking and message fields for claimed users, staff, or a
-- guest with the one-time claim token.

create or replace function public.get_customer_booking(
  booking_id_input uuid,
  claim_token_hash_input text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
begin
  perform public.assert_booking_access(booking_id_input, claim_token_hash_input);

  select * into booking_row
  from public.bookings
  where id = booking_id_input;

  if not found then
    raise exception 'booking not found';
  end if;

  return jsonb_build_object(
    'id', booking_row.id,
    'service_id', booking_row.service_id,
    'service_title', booking_row.service_title,
    'price_cents', booking_row.price_cents,
    'start_at', booking_row.start_at,
    'address', booking_row.address,
    'lat', booking_row.lat,
    'lng', booking_row.lng,
    'travel_miles', booking_row.travel_miles,
    'travel_fee_cents', booking_row.travel_fee_cents,
    'discount_cents', booking_row.discount_cents,
    'total_cents', booking_row.total_cents,
    'status', booking_row.status,
    'short_notice_request', booking_row.short_notice_request,
    'owner_ack_status', booking_row.owner_ack_status,
    'tracker_status', booking_row.tracker_status,
    'last_tracker_at', booking_row.last_tracker_at,
    'guest_name', booking_row.guest_name,
    'guest_phone', booking_row.guest_phone,
    'guest_vehicle_label', booking_row.guest_vehicle_label,
    'customer_access_mode', case when booking_row.claimed_at is null then 'guest' else 'profile' end,
    'claimed_at', booking_row.claimed_at,
    'confirmed_at', booking_row.confirmed_at,
    'declined_at', booking_row.declined_at,
    'reschedule_requested_at', booking_row.reschedule_requested_at,
    'cancelled_at', booking_row.cancelled_at,
    'completed_at', booking_row.completed_at,
    'payment_status', booking_row.payment_status,
    'cancellation_outcome', booking_row.cancellation_outcome,
    'created_at', booking_row.created_at,
    'updated_at', booking_row.updated_at
  );
end;
$$;

create or replace function public.get_customer_booking_messages(
  booking_id_input uuid,
  claim_token_hash_input text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_booking_access(booking_id_input, claim_token_hash_input);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'booking_id', m.booking_id,
        'customer_profile_id', m.customer_profile_id,
        'channel', m.channel,
        'audience', m.audience,
        'direction', m.direction,
        'body', m.body,
        'created_at', m.created_at
      )
      order by m.created_at asc
    )
    from public.messages m
    where m.booking_id = booking_id_input
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_customer_booking(uuid, text) from public;
revoke all on function public.get_customer_booking_messages(uuid, text) from public;

grant execute on function public.get_customer_booking(uuid, text) to anon, authenticated;
grant execute on function public.get_customer_booking_messages(uuid, text) to anon, authenticated;
