-- Customer-safe availability reads. This lets the booking UI show unavailable
-- dates/times without direct table reads or customer/job details.

create or replace function public.get_public_availability(
  from_date_input date default current_date,
  to_date_input date default current_date + 90
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  clean_from date := coalesce(from_date_input, current_date);
  clean_to date := coalesce(to_date_input, current_date + 90);
begin
  if clean_to < clean_from then
    raise exception 'to_date must be on or after from_date';
  end if;

  if clean_to > clean_from + 370 then
    raise exception 'availability range cannot exceed 370 days';
  end if;

  return (
    with manual_blocks as (
      select
        ab.id::text as id,
        ab.block_type,
        ab.block_date,
        ab.time_label,
        'owner_block'::text as source,
        null::text as status,
        ab.created_at
      from public.availability_blocks ab
      where ab.block_date between clean_from and clean_to
    ),
    active_bookings as (
      select
        b.id::text as id,
        'time_slot'::text as block_type,
        (b.start_at at time zone 'America/Chicago')::date as block_date,
        public.local_time_label(b.start_at) as time_label,
        'booking'::text as source,
        b.status::text as status,
        b.created_at
      from public.bookings b
      where b.status in ('requested', 'confirmed')
        and (b.start_at at time zone 'America/Chicago')::date between clean_from and clean_to
    ),
    combined as (
      select * from manual_blocks
      union all
      select * from active_bookings
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'block_type', block_type,
        'block_date', block_date,
        'time_label', time_label,
        'source', source,
        'status', status
      )
      order by block_date, nullif(time_label, ''), source, created_at
    ), '[]'::jsonb)
    from combined
  );
end;
$$;

revoke all on function public.get_public_availability(date, date) from public;
grant execute on function public.get_public_availability(date, date) to anon, authenticated;
