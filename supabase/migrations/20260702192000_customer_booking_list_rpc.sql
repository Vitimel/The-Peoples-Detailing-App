-- Signed-in customer booking history. This returns the same customer-safe
-- shape as get_customer_booking, but only for bookings claimed by auth.uid().

create or replace function public.get_customer_bookings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

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
        'customer_access_mode', 'profile',
        'claimed_at', b.claimed_at,
        'confirmed_at', b.confirmed_at,
        'declined_at', b.declined_at,
        'reschedule_requested_at', b.reschedule_requested_at,
        'cancelled_at', b.cancelled_at,
        'completed_at', b.completed_at,
        'payment_status', b.payment_status,
        'cancellation_outcome', b.cancellation_outcome,
        'created_at', b.created_at,
        'updated_at', b.updated_at
      )
      order by b.start_at desc
    )
    from public.bookings b
    where b.claimed_by_user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_customer_bookings() from public;
grant execute on function public.get_customer_bookings() to authenticated;
