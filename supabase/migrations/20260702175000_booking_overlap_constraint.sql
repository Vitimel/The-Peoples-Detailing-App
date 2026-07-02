-- Database-level overlap protection for real bookings.
-- RPC validation catches normal conflicts, but the exclusion constraint is the
-- final guard against two concurrent requests booking overlapping work.

alter table public.bookings
  add column if not exists end_at timestamptz;

update public.bookings
set end_at = public.booking_end_at(service_id, start_at)
where end_at is null
  and service_id is not null
  and start_at is not null;

create or replace function public.set_booking_end_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.service_id is null or new.start_at is null then
    raise exception 'service_id and start_at are required';
  end if;

  new.end_at := public.booking_end_at(new.service_id, new.start_at);
  return new;
end;
$$;

drop trigger if exists set_booking_end_at_before_write on public.bookings;
create trigger set_booking_end_at_before_write
  before insert or update of service_id, start_at
  on public.bookings
  for each row execute function public.set_booking_end_at();

alter table public.bookings
  alter column end_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_end_after_start'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_end_after_start
      check (end_at > start_at);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_active_overlap'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_no_active_overlap
      exclude using gist (
        tstzrange(start_at, end_at, '[)') with &&
      )
      where (status in ('requested', 'confirmed'))
      deferrable initially immediate;
  end if;
end $$;

create index if not exists bookings_active_range_idx
  on public.bookings
  using gist (tstzrange(start_at, end_at, '[)'))
  where status in ('requested', 'confirmed');

revoke all on function public.set_booking_end_at() from public;
