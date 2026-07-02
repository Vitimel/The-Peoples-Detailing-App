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
- `supabase/migrations/20260702143000_owner_operations_rpc.sql` adds repo-ready owner operation RPCs for acknowledging bookings, confirming/declining short-notice requests, requesting reschedules, updating MVP tracker statuses, and managing availability blocks.
- `supabase/migrations/20260702150000_customer_lifecycle_rpc.sql` adds repo-ready booking lifecycle RPCs for customer/guest cancellation, rescheduling, and in-app messages with access checks for owner/developer, signed-in claimed customers, or matching guest claim tokens.
- `supabase/migrations/20260702153000_developer_admin_rpc.sql` adds developer-only RPCs for service pricing/duration, money settings, and integration readiness while keeping Stripe live mode and SMS provider activation locked.
- `supabase/seed.sql` seeds the current service menu, business settings, and integration statuses for a fresh Supabase project.
- `src/data/appDataLayer.js` now includes a disabled-by-default Supabase REST adapter contract for reading services/settings/bookings/availability/messages/integration status and calling the safe booking, owner operation, customer lifecycle, and developer admin RPCs.
- `src/data/supabaseMappings.js` translates future Supabase rows into the app's current service, settings, booking, availability, message, and RPC payload shapes so turning on Supabase later does not leak database column names into the UI.
- Unit tests cover the extracted booking rules, Supabase mapping helpers, adapter contract, and migration readiness.

## Still Not Live

- No Supabase URL or anon key is configured.
- No Supabase Auth sign-in is wired to the frontend.
- No service-role key is stored anywhere in this frontend repo.
- No real SMS provider is called.
- No Stripe Checkout, PaymentIntent, webhook, or Connect routing is enabled.
- No real map/routing or reverse geocoding provider is enabled.

## Next Technical Step

Apply the migrations to a new Supabase Free project, run `supabase/seed.sql`, verify RLS, then set frontend env vars while keeping `VITE_USE_SUPABASE=false` until the live verification checklist passes. After that, test the disabled REST adapter against the live project's public services/settings, booking RPC, owner operation RPCs, customer lifecycle RPCs, and developer admin RPCs before making it the active data source.

See `docs/SUPABASE_FREE_SETUP_STEPS.md`.

## Required Tim/Dane Decisions Before Live Data

- Confirm final brand name: `The Peoples Detailing`, `Dane's Detail`, or both.
- Confirm final service list, prices, durations, and buffer time.
- Confirm whether first live payment is no-payment booking, deposit-only, full-card, or both.
- Confirm cancellation/reschedule copy and whether the 7-day deposit forfeiture rule is correct.
- Confirm who owns the Supabase, Stripe, SMS, and domain accounts.

## Safety Boundary

This repo can now be closer to production without spending money, but real launch still requires Supabase Auth/RLS verification before storing customer data.
