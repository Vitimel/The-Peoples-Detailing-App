-- Repo-ready owner operation RPCs. These keep Dane's future backend actions
-- server-side and auditable without enabling live Supabase yet.

alter table public.bookings
  add column if not exists tracker_status text,
  add column if not exists last_tracker_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists reschedule_requested_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists payment_status text,
  add column if not exists cancellation_outcome text;

create index if not exists owner_acknowledgments_booking_idx
  on public.owner_acknowledgments (booking_id);

create index if not exists status_events_booking_created_idx
  on public.status_events (booking_id, created_at desc);

create or replace function public.assert_owner_or_developer()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_owner_or_developer() then
    raise exception 'owner or developer role required';
  end if;
end;
$$;

create or replace function public.owner_acknowledge_booking(booking_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
begin
  perform public.assert_owner_or_developer();

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status <> 'confirmed' then
    raise exception 'only confirmed bookings can be acknowledged';
  end if;

  update public.bookings
  set owner_ack_status = 'acknowledged',
      updated_at = now()
  where id = booking_id_input;

  insert into public.owner_acknowledgments (
    booking_id, status, acknowledged_by, acknowledged_at
  )
  values (
    booking_id_input, 'acknowledged', auth.uid(), now()
  );

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input, 'owner_acknowledged', 'acknowledged', auth.uid()
  );

  return booking_id_input;
end;
$$;

create or replace function public.owner_decide_booking_request(
  booking_id_input uuid,
  decision text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_decision text := lower(trim(coalesce(decision, '')));
  new_status public.booking_status;
  new_ack_status text;
  booking_row public.bookings%rowtype;
begin
  perform public.assert_owner_or_developer();

  if normalized_decision not in ('confirm', 'decline') then
    raise exception 'decision must be confirm or decline';
  end if;

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status <> 'requested' then
    raise exception 'only requested bookings can be confirmed or declined here';
  end if;

  new_status := case when normalized_decision = 'confirm' then 'confirmed'::public.booking_status else 'declined'::public.booking_status end;
  new_ack_status := case when normalized_decision = 'confirm' then 'needs_ack' else 'declined' end;

  update public.bookings
  set status = new_status,
      owner_ack_status = new_ack_status,
      confirmed_at = case when normalized_decision = 'confirm' then now() else confirmed_at end,
      declined_at = case when normalized_decision = 'decline' then now() else declined_at end,
      payment_status = case when normalized_decision = 'decline' then 'not_collected' else coalesce(payment_status, 'balance_due') end,
      cancellation_outcome = case when normalized_decision = 'decline' then 'Request declined - no payment collected' else cancellation_outcome end,
      updated_at = now()
  where id = booking_id_input;

  insert into public.owner_acknowledgments (booking_id, status)
  values (booking_id_input, new_ack_status);

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input,
    case when normalized_decision = 'confirm' then 'owner_confirmed_request' else 'owner_declined_request' end,
    new_status::text,
    auth.uid()
  );

  return booking_id_input;
end;
$$;

create or replace function public.owner_request_booking_reschedule(booking_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
begin
  perform public.assert_owner_or_developer();

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status not in ('requested', 'confirmed') then
    raise exception 'only active bookings can request reschedule';
  end if;

  update public.bookings
  set owner_ack_status = 'reschedule_requested',
      reschedule_requested_at = now(),
      updated_at = now()
  where id = booking_id_input;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input, 'owner_requested_reschedule', 'reschedule_requested', auth.uid()
  );

  return booking_id_input;
end;
$$;

create or replace function public.owner_update_booking_tracker(
  booking_id_input uuid,
  tracker_status_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_status text := lower(trim(coalesce(tracker_status_input, '')));
  booking_row public.bookings%rowtype;
begin
  perform public.assert_owner_or_developer();

  if normalized_status not in ('on_my_way', 'arrived', 'complete') then
    raise exception 'tracker status must be on_my_way, arrived, or complete';
  end if;

  select * into booking_row
  from public.bookings
  where id = booking_id_input
  for update;

  if not found then
    raise exception 'booking not found';
  end if;

  if booking_row.status <> 'confirmed' and not (booking_row.status = 'complete' and normalized_status = 'complete') then
    raise exception 'only confirmed bookings can receive tracker updates';
  end if;

  update public.bookings
  set tracker_status = normalized_status,
      last_tracker_at = now(),
      status = case when normalized_status = 'complete' then 'complete'::public.booking_status else status end,
      completed_at = case when normalized_status = 'complete' then now() else completed_at end,
      payment_status = case when normalized_status = 'complete' then coalesce(payment_status, 'complete') else payment_status end,
      updated_at = now()
  where id = booking_id_input;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    booking_id_input, 'owner_tracker_update', normalized_status, auth.uid()
  );

  return booking_id_input;
end;
$$;

create or replace function public.owner_set_availability_block(
  block_type_input text,
  block_date_input date,
  time_label_input text default null,
  reason_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_block_id uuid;
  normalized_type text := lower(trim(coalesce(block_type_input, '')));
begin
  perform public.assert_owner_or_developer();

  if normalized_type not in ('full_day', 'time_slot') then
    raise exception 'block type must be full_day or time_slot';
  end if;

  if normalized_type = 'time_slot' and coalesce(trim(time_label_input), '') = '' then
    raise exception 'time_label is required for time_slot blocks';
  end if;

  insert into public.availability_blocks (
    block_type, block_date, time_label, reason, created_by
  )
  values (
    normalized_type,
    block_date_input,
    case when normalized_type = 'time_slot' then trim(time_label_input) else null end,
    nullif(trim(coalesce(reason_input, '')), ''),
    auth.uid()
  )
  returning id into new_block_id;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    null, 'owner_availability_blocked', normalized_type, auth.uid()
  );

  return new_block_id;
end;
$$;

create or replace function public.owner_remove_availability_block(block_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_owner_or_developer();

  delete from public.availability_blocks
  where id = block_id_input;

  if not found then
    raise exception 'availability block not found';
  end if;

  insert into public.status_events (
    booking_id, event_type, status, created_by
  )
  values (
    null, 'owner_availability_unblocked', 'removed', auth.uid()
  );

  return block_id_input;
end;
$$;

revoke all on function public.assert_owner_or_developer() from public;
revoke all on function public.owner_acknowledge_booking(uuid) from public;
revoke all on function public.owner_decide_booking_request(uuid, text) from public;
revoke all on function public.owner_request_booking_reschedule(uuid) from public;
revoke all on function public.owner_update_booking_tracker(uuid, text) from public;
revoke all on function public.owner_set_availability_block(text, date, text, text) from public;
revoke all on function public.owner_remove_availability_block(uuid) from public;

grant execute on function public.owner_acknowledge_booking(uuid) to authenticated;
grant execute on function public.owner_decide_booking_request(uuid, text) to authenticated;
grant execute on function public.owner_request_booking_reschedule(uuid) to authenticated;
grant execute on function public.owner_update_booking_tracker(uuid, text) to authenticated;
grant execute on function public.owner_set_availability_block(text, date, text, text) to authenticated;
grant execute on function public.owner_remove_availability_block(uuid) to authenticated;
