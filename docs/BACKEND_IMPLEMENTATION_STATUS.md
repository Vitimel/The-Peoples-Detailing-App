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
- `supabase/migrations/20260702160000_auth_role_hardening.sql` hardens app-role helpers for RLS, creates a `profiles` row when Supabase Auth creates a user, and adds a developer-only role assignment RPC for setting Tim/Dane/customer roles after manual bootstrap.
- `supabase/migrations/20260702170000_guest_claim_token_contract.sql` makes guest booking/profile claiming usable by returning a one-time raw claim token from `create_guest_booking`, storing only its hash, and accepting the raw token for future claim, cancel, reschedule, and message access.
- `supabase/migrations/20260702175000_booking_overlap_constraint.sql` adds a database-level `end_at` field, trigger, and GiST exclusion constraint so overlapping active bookings are rejected even under concurrent requests.
- `supabase/migrations/20260702180000_customer_booking_read_rpc.sql` adds token-gated customer-safe read RPCs so a guest can reopen their booking and messages without direct table access or staff-only app-fee/payment/SMS records.
- `supabase/migrations/20260702185000_owner_job_read_rpc.sql` adds a role-gated owner job queue RPC so Dane can load operational jobs, messages counts, and owner SMS placeholder status without stitching raw tables together.
- `supabase/migrations/20260702190000_developer_admin_read_rpc.sql` adds a developer-only admin snapshot RPC so Tim can load service pricing, developer money settings, integration readiness, and live-mode lock status without exposing bookings, payment placeholder internals, SMS queue rows, or claim tokens.
- `supabase/migrations/20260702191000_public_availability_read_rpc.sql` adds a customer-safe public availability RPC so the booking calendar can see owner blocks and active booked/requested slots without exposing owner reasons, customer contact info, claim tokens, payment internals, or SMS records.
- `supabase/migrations/20260702192000_customer_booking_list_rpc.sql` adds a signed-in customer booking history RPC so profile users can list only their own claimed bookings without raw booking-table fields such as stored claim hashes or auth user IDs.
- `supabase/seed.sql` seeds the current service menu, business settings, and integration statuses for a fresh Supabase project.
- `supabase/verification/live_smoke_checks.sql` gives Tim a no-cost SQL Editor preflight for schema/RPC/seed/payment-lock/SMS-placeholder checks after the migrations are applied.
- `docs/SUPABASE_LIVE_VERIFICATION_CHECKLIST.md` records the API and RLS checks that must pass before `VITE_USE_SUPABASE=true` or real customer data.
- `scripts/verify-supabase-api.mjs` and `npm run verify:supabase-api` provide a no-dependency live API/RLS runner for a Supabase test project using anon, developer, owner, and two customer test accounts.
- `src/data/appDataLayer.js` now includes a disabled-by-default Supabase REST adapter contract for reading services/settings/customer-safe availability/customer-safe booking history/access-checked booking messages/integration status/admin snapshots and calling the safe booking, owner operation, customer lifecycle, developer admin, and app-role RPCs.
- The Supabase REST adapter can use a signed-in user's access token through `accessToken` or a fresh `getAccessToken()` callback, while public/guest calls still fall back to the anon key. No service-role key is used.
- `src/data/appDataLayer.js` also includes a no-dependency Supabase Auth REST adapter contract for future email sign-up, password sign-in, current-user lookup, and sign-out using only the public anon key plus user access tokens.
- `src/data/supabaseMappings.js` translates future Supabase rows into the app's current service, settings, booking, availability, message, and RPC payload shapes so turning on Supabase later does not leak database column names into the UI.
- Unit tests cover the extracted booking rules, Supabase mapping helpers, adapter contract, and migration readiness.

## Still Not Live

- No Supabase URL or anon key is configured.
- No Supabase Auth sign-in is wired to the frontend.
- No Supabase Auth adapter is active in the UI yet.
- No live Supabase user session is passed into the adapter yet.
- No service-role key is stored anywhere in this frontend repo.
- No real SMS provider is called.
- No Stripe Checkout, PaymentIntent, webhook, or Connect routing is enabled.
- No real map/routing or reverse geocoding provider is enabled.

## Next Technical Step

Apply the migrations to a new Supabase Free project, run `supabase/seed.sql`, run `supabase/verification/live_smoke_checks.sql`, manually bootstrap the first developer profile, verify API/RLS behavior with `npm run verify:supabase-api` and `docs/SUPABASE_LIVE_VERIFICATION_CHECKLIST.md`, then set frontend env vars while keeping `VITE_USE_SUPABASE=false` until the live verification checklist passes. After that, test the disabled REST adapter against the live project's public services/settings, public availability RPC, customer-safe booking history RPC, booking-message read RPC, booking RPC, owner operation RPCs, customer lifecycle RPCs, developer admin read/write RPCs, and app-role RPC before making it the active data source.

See `docs/SUPABASE_FREE_SETUP_STEPS.md`.

## Required Tim/Dane Decisions Before Live Data

- Confirm final brand name: `The Peoples Detailing`, `Dane's Detail`, or both.
- Confirm final service list, prices, durations, and buffer time.
- Confirm whether first live payment is no-payment booking, deposit-only, full-card, or both.
- Confirm cancellation/reschedule copy and whether the 7-day deposit forfeiture rule is correct.
- Confirm who owns the Supabase, Stripe, SMS, and domain accounts.

## Safety Boundary

This repo can now be closer to production without spending money, but real launch still requires Supabase Auth/RLS verification before storing customer data.
