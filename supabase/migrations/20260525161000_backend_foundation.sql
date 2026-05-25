-- The Peoples Detailing repo-ready backend foundation.
-- This migration is not applied to a live project yet.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'owner', 'developer');
create type public.booking_status as enum ('requested', 'confirmed', 'complete', 'cancelled', 'declined');
create type public.notification_status as enum ('queued', 'would_send', 'sent', 'failed', 'cancelled');
create type public.payment_routing_status as enum ('not_collected', 'ledger_only', 'stripe_test_ready', 'stripe_test_routed', 'stripe_live_routed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  name text,
  phone text,
  notification_preference text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  phone text,
  default_vehicle_id uuid,
  notification_preference text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id text primary key,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  duration_hours numeric not null default 2,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid references public.customer_profiles(id) on delete cascade,
  nickname text not null,
  year text,
  make text,
  model text,
  color text,
  plate text,
  vin text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  service_id text references public.services(id),
  service_title text not null,
  price_cents integer not null default 0,
  start_at timestamptz not null,
  address text not null,
  lat numeric,
  lng numeric,
  travel_miles numeric not null default 0,
  travel_fee_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  status public.booking_status not null default 'confirmed',
  short_notice_request boolean not null default false,
  owner_ack_status text,
  guest_name text,
  guest_phone text,
  guest_vehicle_label text,
  claim_token_hash text,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index bookings_active_slot_idx
  on public.bookings (start_at)
  where status in ('requested', 'confirmed');

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  block_type text not null check (block_type in ('full_day', 'time_slot')),
  block_date date not null,
  time_label text,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  channel text not null default 'in_app',
  audience text not null,
  direction text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.owner_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null default 'needs_ack',
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  event_type text not null,
  status text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payment_placeholders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null default 'stripe',
  mode text not null default 'test_mode_ready_not_connected',
  checkout_session_id text,
  payment_intent_id text,
  connected_account_id text,
  application_fee_amount_cents integer not null default 0,
  amount_cents integer not null default 0,
  deposit_cents integer not null default 0,
  card_processing_fee_cents integer not null default 0,
  routing_status public.payment_routing_status not null default 'ledger_only',
  live_mode boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_fee_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_placeholder_id uuid references public.payment_placeholders(id) on delete set null,
  gross_app_fee_cents integer not null default 300,
  sms_estimate_cents integer not null default 0,
  net_brandnew_estimate_cents integer not null default 300,
  routing_status public.payment_routing_status not null default 'ledger_only',
  sms_cost_status text not null default 'estimated_not_billed',
  visible_to_customer boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sms_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  audience text not null default 'owner',
  provider text not null default 'not_connected',
  to_role text not null default 'owner',
  status public.notification_status not null default 'would_send',
  cost_estimate_cents integer not null default 0,
  cost_status text not null default 'estimated_not_billed',
  body_preview text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.integration_status (
  id text primary key,
  status text not null,
  details text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.services enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.messages enable row level security;
alter table public.owner_acknowledgments enable row level security;
alter table public.status_events enable row level security;
alter table public.payment_placeholders enable row level security;
alter table public.app_fee_ledger_entries enable row level security;
alter table public.sms_notifications enable row level security;
alter table public.integration_status enable row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer'::public.app_role);
$$;

create or replace function public.is_owner_or_developer()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('owner', 'developer');
$$;

create policy "profiles read own or staff" on public.profiles
  for select using (id = auth.uid() or public.is_owner_or_developer());

create policy "customer profiles read own or staff" on public.customer_profiles
  for select using (user_id = auth.uid() or public.is_owner_or_developer());

create policy "customer profiles update own or staff" on public.customer_profiles
  for update using (user_id = auth.uid() or public.is_owner_or_developer());

create policy "public services readable" on public.services
  for select using (visible = true or public.is_owner_or_developer());

create policy "developer manages services" on public.services
  for all using (public.current_app_role() = 'developer')
  with check (public.current_app_role() = 'developer');

create policy "vehicles own or staff" on public.vehicles
  for all using (
    public.is_owner_or_developer()
    or customer_profile_id in (select id from public.customer_profiles where user_id = auth.uid())
  )
  with check (
    public.is_owner_or_developer()
    or customer_profile_id in (select id from public.customer_profiles where user_id = auth.uid())
  );

create policy "bookings read claimed own or staff" on public.bookings
  for select using (public.is_owner_or_developer() or claimed_by_user_id = auth.uid());

create policy "bookings owner manages" on public.bookings
  for all using (public.is_owner_or_developer())
  with check (public.is_owner_or_developer());

create policy "owner availability manage" on public.availability_blocks
  for all using (public.is_owner_or_developer())
  with check (public.is_owner_or_developer());

create policy "messages own booking or staff" on public.messages
  for select using (
    public.is_owner_or_developer()
    or booking_id in (select id from public.bookings where claimed_by_user_id = auth.uid())
  );

create policy "owner operational records" on public.owner_acknowledgments
  for all using (public.is_owner_or_developer())
  with check (public.is_owner_or_developer());

create policy "status visible to claimed or staff" on public.status_events
  for select using (
    public.is_owner_or_developer()
    or booking_id in (select id from public.bookings where claimed_by_user_id = auth.uid())
  );

create policy "payment records staff only" on public.payment_placeholders
  for all using (public.is_owner_or_developer())
  with check (public.is_owner_or_developer());

create policy "ledger records staff only" on public.app_fee_ledger_entries
  for all using (public.is_owner_or_developer())
  with check (public.is_owner_or_developer());

create policy "sms records staff only" on public.sms_notifications
  for all using (public.is_owner_or_developer())
  with check (public.is_owner_or_developer());

create policy "developer integration status" on public.integration_status
  for all using (public.current_app_role() = 'developer')
  with check (public.current_app_role() = 'developer');

create or replace function public.create_guest_booking(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking_id uuid;
begin
  -- Repo-ready stub: final implementation must validate payload, working hours,
  -- blocked dates/times, service duration, and short-notice rules before insert.
  insert into public.bookings (
    service_id, service_title, price_cents, start_at, address, lat, lng,
    travel_miles, travel_fee_cents, discount_cents, total_cents, status,
    short_notice_request, owner_ack_status, guest_name, guest_phone,
    guest_vehicle_label, claim_token_hash
  )
  values (
    payload->>'service_id',
    payload->>'service_title',
    coalesce((payload->>'price_cents')::integer, 0),
    (payload->>'start_at')::timestamptz,
    payload->>'address',
    nullif(payload->>'lat', '')::numeric,
    nullif(payload->>'lng', '')::numeric,
    coalesce((payload->>'travel_miles')::numeric, 0),
    coalesce((payload->>'travel_fee_cents')::integer, 0),
    coalesce((payload->>'discount_cents')::integer, 0),
    coalesce((payload->>'total_cents')::integer, 0),
    coalesce((payload->>'status')::public.booking_status, 'confirmed'),
    coalesce((payload->>'short_notice_request')::boolean, false),
    payload->>'owner_ack_status',
    payload->>'guest_name',
    payload->>'guest_phone',
    payload->>'guest_vehicle_label',
    payload->>'claim_token_hash'
  )
  returning id into new_booking_id;

  return new_booking_id;
end;
$$;
