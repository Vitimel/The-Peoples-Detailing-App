# Backend Implementation Status

**Status:** repo-ready foundation. No live Supabase project, real customer data, live SMS, or live Stripe is connected.

## What Is Ready In This Repo

- `src/utils/bookingRules.js` is now the shared frontend booking-rule source for slot labels, blocked days/times, overlap checks, service duration, buffer time, short-notice approval, customer reschedule cutoff, and cancellation deposit outcome.
- `supabase/migrations/20260525161000_backend_foundation.sql` defines the first table/RLS scaffold.
- `supabase/migrations/20260702130000_booking_rpc_validation.sql` adds the production-shaped booking RPC:
  - validates service, future start time, address, working hours, blocked days/times, and overlapping active bookings;
  - treats open slots inside the minimum notice window as `requested` short-notice bookings;
  - creates owner acknowledgment, status event, payment placeholder, app-fee ledger, and SMS queue records in the same transaction;
  - keeps Stripe/SMS provider calls disabled and placeholder-only;
  - adds a future `claim_guest_booking` function for signed-in customers to claim a guest booking.
- Unit tests cover the extracted booking rules and migration readiness.

## Still Not Live

- No Supabase URL or anon key is configured.
- No Supabase Auth sign-in is wired to the frontend.
- No service-role key is stored anywhere in this frontend repo.
- No real SMS provider is called.
- No Stripe Checkout, PaymentIntent, webhook, or Connect routing is enabled.
- No real map/routing or reverse geocoding provider is enabled.

## Next Technical Step

Apply the migrations to a new Supabase Free project, seed the `services` and `business_settings` tables, and wire a disabled-by-default Supabase adapter that can read public services/availability and call `create_guest_booking` only when environment variables are present.

## Required Tim/Dane Decisions Before Live Data

- Confirm final brand name: `The Peoples Detailing`, `Dane's Detail`, or both.
- Confirm final service list, prices, durations, and buffer time.
- Confirm whether first live payment is no-payment booking, deposit-only, full-card, or both.
- Confirm cancellation/reschedule copy and whether the 7-day deposit forfeiture rule is correct.
- Confirm who owns the Supabase, Stripe, SMS, and domain accounts.

## Safety Boundary

This repo can now be closer to production without spending money, but real launch still requires Supabase Auth/RLS verification before storing customer data.
