-- Repo-ready customer lifecycle RPCs. These cover cancellation, customer/owner
-- rescheduling, and in-app message records without connecting paid providers.

create index if not exists messages_booking_created_idx
  on public.messages (booking_id, created_at desc);

create or replace function public.can_access_booking(
  booking_id_input uuid,
  claim_token_hash_input text default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = booking_id_input
      and (
        public.is_owner_or_developer()
        or b.claimed_by_user_id = auth.uid()
        or (
          claim_token_hash_input is not null
          and b.claim_token_hash = claim_token_hash_input
        )
      )
  );
$$;

create or replace function public.assert_booking_access(
  booking_id_input uuid,
  claim_token_hash_input text default null
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_access_booking(booking_id_input, claim_token_hash_input) then
    raise exception 'booking access denied';
  end if;
end;
$$;

create or replace function public.validate_booking_slot(
  booking_id_to_ignore uuid,
  service_id_input text,
  requested_start timestamptz,
  requested_time_label text
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  requested_end timestamptz;
  local_start timestamp;
  local_hour numeric;
begin
  if requested_start is null then
    raise exception 'start_at is required';
  end if;

  if requested_start < now() then
    raise exception 'booking time must be in the future';
  end if;

  local_start := requested_start at time zone 'America/Chicago';
  local_hour := extract(hour from local_start) + extract(minute from local_start) / 60.0;
  requested_end := public.booking_end_at(service_id_input, requested_start);

  if local_hour < public.setting_number('working_hours_start', 8)
    or local_hour >= public.setting_number('working_hours_end', 19.5)
    or extract(hour from requested_end at time zone 'America/Chicago') + extract(minute from requested_end at time zone 'America/Chicago') / 60.0 > public.setting_number('working_hours_end', 19.5)
  then
    raise exception 'requested time is outside working hours';
  end if;

  if exists (
    select 1
    from public.availability_blocks
    where block_date = (local_start::date)
      and (
        block_type = 'full_day'
        or (block_type = 'time_slot' and time_label = requested_time_label)
      )
  ) then
    raise exception 'requested time is blocked';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.status in ('requested', 'confirmed')
      and b.id <> booking_id_to_ignore
      and tstzrange(b.start_at, public.booking_end_at(b.service_id, b.start_at), '[)')
        && tstzrange(requested_start, requested_end, '[)')
  ) then
    raise exception 'requested time is already booked';
  end if;
end;
$$;

create or replace function public.customer_cancel_booking(
  booking_id_input uuid,
  claim_token_hash_input text default null,
  reason_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
  paid_amount integer := 0;
  forfeit boolean := false;
begin
  perform public.assert_booking_access(booking_id_input, claim_token_hash_input);

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status not in ('requested', 'confirmed') then
    raise exception 'only active bookings can be cancelled';
  end if;

  select coalesce(max(amount_cents), 0) into paid_amount
  from public.payment_placeholders
  where booking_id = booking_id_input;

  forfeit := paid_amount > 0
    and booking_row.status = 'confirmed'
    and booking_row.start_at < now() + make_interval(days => public.setting_number('cancel_deposit_forfeit_days', 7)::integer);

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      payment_status = case
        when paid_amount <= 0 or booking_row.status = 'requested' then 'not_collected'
        when forfeit then 'cancelled_deposit_forfeited'
        else 'refunded'
      end,
      cancellation_outcome = case
        when paid_amount <= 0 or booking_row.status = 'requested' then 'No payment collected'
        when forfeit then 'Deposit forfeited'
        else 'Deposit refundable'
      end,
      updated_at = now()
  where id = booking_id_input;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input, 'booking_cancelled', case when forfeit then 'cancelled_deposit_forfeited' else 'cancelled' end, auth.uid()
  );

  if nullif(trim(coalesce(reason_input, '')), '') is not null then
    insert into public.messages (
      booking_id, customer_profile_id, channel, audience, direction, body
    )
    values (
      booking_id_input,
      booking_row.customer_profile_id,
      'in_app',
      'owner',
      'inbound',
      'Cancellation reason: ' || trim(reason_input)
    );
  end if;

  return booking_id_input;
end;
$$;

create or replace function public.reschedule_booking(
  booking_id_input uuid,
  new_start_at_input timestamptz,
  time_label_input text default null,
  claim_token_hash_input text default null,
  reason_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
  requested_time_label text;
  staff_actor boolean := public.is_owner_or_developer();
begin
  perform public.assert_booking_access(booking_id_input, claim_token_hash_input);

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status not in ('requested', 'confirmed') then
    raise exception 'only active bookings can be rescheduled';
  end if;

  if not staff_actor then
    if booking_row.status = 'requested' or booking_row.short_notice_request then
      raise exception 'short-notice requests cannot be rescheduled online by the customer';
    end if;

    if booking_row.start_at < now() + make_interval(hours => public.setting_number('reschedule_cutoff_hours', 48)::integer) then
      raise exception 'inside customer reschedule cutoff';
    end if;
  end if;

  requested_time_label := coalesce(nullif(time_label_input, ''), public.local_time_label(new_start_at_input));
  perform public.validate_booking_slot(booking_id_input, booking_row.service_id, new_start_at_input, requested_time_label);

  update public.bookings
  set start_at = new_start_at_input,
      owner_ack_status = case when staff_actor then owner_ack_status else 'needs_ack' end,
      reschedule_requested_at = null,
      updated_at = now()
  where id = booking_id_input;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input,
    case when staff_actor then 'owner_rescheduled_booking' else 'customer_rescheduled_booking' end,
    'rescheduled',
    auth.uid()
  );

  if nullif(trim(coalesce(reason_input, '')), '') is not null then
    insert into public.messages (
      booking_id, customer_profile_id, channel, audience, direction, body
    )
    values (
      booking_id_input,
      booking_row.customer_profile_id,
      'in_app',
      case when staff_actor then 'customer' else 'owner' end,
      case when staff_actor then 'outbound' else 'inbound' end,
      'Reschedule note: ' || trim(reason_input)
    );
  end if;

  return booking_id_input;
end;
$$;

create or replace function public.create_booking_message(
  booking_id_input uuid,
  body_input text,
  claim_token_hash_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_message_id uuid;
  booking_row public.bookings%rowtype;
  staff_actor boolean := public.is_owner_or_developer();
  clean_body text := trim(coalesce(body_input, ''));
begin
  perform public.assert_booking_access(booking_id_input, claim_token_hash_input);

  if length(clean_body) < 1 then
    raise exception 'message body is required';
  end if;

  if length(clean_body) > 1000 then
    raise exception 'message body is too long';
  end if;

  select * into booking_row
  from public.bookings
  where id = booking_id_input;

  if not found then
    raise exception 'booking not found';
  end if;

  insert into public.messages (
    booking_id, customer_profile_id, channel, audience, direction, body
  )
  values (
    booking_id_input,
    booking_row.customer_profile_id,
    'in_app',
    case when staff_actor then 'customer' else 'owner' end,
    case when staff_actor then 'outbound' else 'inbound' end,
    clean_body
  )
  returning id into new_message_id;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input,
    case when staff_actor then 'owner_message_sent' else 'customer_message_sent' end,
    'message_created',
    auth.uid()
  );

  if not staff_actor then
    insert into public.sms_notifications (
      booking_id, audience, provider, to_role, status,
      cost_estimate_cents, cost_status, body_preview
    )
    values (
      booking_id_input, 'owner', 'not_connected', 'owner', 'would_send',
      public.setting_number('owner_sms_estimate_cents', 1)::integer,
      'estimated_not_billed',
      left(clean_body, 160)
    );
  end if;

  return new_message_id;
end;
$$;

revoke all on function public.can_access_booking(uuid, text) from public;
revoke all on function public.assert_booking_access(uuid, text) from public;
revoke all on function public.validate_booking_slot(uuid, text, timestamptz, text) from public;
revoke all on function public.customer_cancel_booking(uuid, text, text) from public;
revoke all on function public.reschedule_booking(uuid, timestamptz, text, text, text) from public;
revoke all on function public.create_booking_message(uuid, text, text) from public;

grant execute on function public.customer_cancel_booking(uuid, text, text) to anon, authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.create_booking_message(uuid, text, text) to anon, authenticated;
