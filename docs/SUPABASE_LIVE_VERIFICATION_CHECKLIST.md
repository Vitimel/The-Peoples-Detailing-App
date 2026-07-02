# Supabase Live Verification Checklist

**Status:** pre-live checklist. Use this after creating a Supabase Free project and applying the repo migrations. Do not store private keys in this repo.

## Goal

Prove the backend is logically safe before real customer data enters it:

- Customer bookings create real database records.
- Availability, overlap, short-notice, cancellation, and reschedule rules are enforced server-side.
- Dane/owner tools are role-gated.
- Tim/developer tools are role-gated.
- Hidden BrandNew app-fee ledger stays hidden from customers.
- SMS and Stripe remain placeholder-only until explicitly approved.

## Apply And Seed

Follow `docs/SUPABASE_FREE_SETUP_STEPS.md` exactly. Apply every migration in order, then run `supabase/seed.sql`.

After that, run:

```sql
supabase/verification/live_smoke_checks.sql
```

The smoke check intentionally rolls back its test records. Passing it means the schema, seed data, core RPCs, hidden app-fee ledger, placeholder SMS, payment lock, and normal/short-notice booking shapes are present.

## Why API Tests Still Matter

The Supabase SQL Editor can run as an elevated database role, so it can bypass the same permissions a customer, owner, or developer would hit from the app. Treat the SQL smoke check as a preflight only.

Before turning `VITE_USE_SUPABASE=true`, also verify the API behavior below with the public anon key and signed-in test accounts.

## API/RLS Runner

After the SQL smoke check passes, use the repo's no-dependency Node runner against the same Supabase project:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-public-anon-key"
$env:SUPABASE_DEVELOPER_EMAIL="tim-test@example.com"
$env:SUPABASE_DEVELOPER_PASSWORD="test-password"
$env:SUPABASE_OWNER_EMAIL="dane-test@example.com"
$env:SUPABASE_OWNER_PASSWORD="test-password"
$env:SUPABASE_CUSTOMER_A_EMAIL="customer-a-test@example.com"
$env:SUPABASE_CUSTOMER_A_PASSWORD="test-password"
$env:SUPABASE_CUSTOMER_B_EMAIL="customer-b-test@example.com"
$env:SUPABASE_CUSTOMER_B_PASSWORD="test-password"
npm run verify:supabase-api
```

Use a fresh/test Supabase project or obvious test accounts. The runner creates test bookings, messages, role assignments, and availability blocks so it can prove real API behavior. It does not use paid services, service-role keys, live SMS, live Stripe, maps, or new dependencies.

## Test Accounts

Create these Supabase Auth users:

- Tim test developer
- Dane test owner
- Customer A
- Customer B

Manually bootstrap Tim once by setting his `public.profiles.role` to `developer` in Supabase SQL Editor. Then use `developer_assign_app_role` to set Dane to `owner`.

Never put the service-role key in GitHub Pages, `.env`, or frontend code.

The frontend adapter should use the anon key for public/guest calls and a signed-in user's Supabase access token for customer, owner, and developer RPCs. Do not test owner/developer RPCs with the anon key alone.

Before wiring the real login UI, verify the Auth REST adapter can sign up/sign in test users, read the current user with the returned access token, and sign out without any service-role key.

## Anonymous Customer Checks

- Public services can be read with the anon key.
- Public safe business settings can be read with the anon key.
- Public availability can be read through `get_public_availability`.
- Public availability includes manual owner blocks and active booked/requested slots without exposing owner reasons, customer contact, claim tokens, payment records, or SMS records.
- Public checkout totals can be quoted through `get_checkout_quote`.
- Checkout quote includes service price, travel fee, discount, deposit/full/pay-later choice, card-processing fee, due today, and balance due.
- Checkout quote does not expose `company_app_fee_cents`, hidden app-fee amounts, payment placeholder rows, app-fee ledger rows, or SMS queue rows.
- Hidden settings are not readable by anon/customer: `company_app_fee_cents`, `owner_sms_estimate_cents`, `sms_provider`, card-processing internals unless intentionally exposed later.
- `create_guest_booking` works with a valid service, future time, address, guest name, phone, and vehicle label.
- `create_guest_booking` returns both `booking_id` and a one-time raw `claim_token`.
- The booking row stores `claim_token_hash`, not the raw `claim_token`.
- The raw `claim_token` can read the booking through `get_customer_booking`.
- The raw `claim_token` can read in-app messages through `get_customer_booking_messages`.
- The raw `claim_token` can read safe booking history through `get_booking_timeline`.
- Booking message reads use `get_customer_booking_messages`; the frontend does not need direct `messages` table reads.
- Customer-safe read RPCs do not return `claim_token_hash`, raw auth user IDs, app-fee ledger rows, payment placeholders, or SMS queue rows.
- Booking timeline reads do not return `created_by`, raw auth user IDs, app-fee ledger rows, payment placeholders, SMS queue rows, or claim-token fields.
- A normal future booking becomes `confirmed` and `owner_ack_status = needs_ack`.
- A short-notice booking inside `minimum_booking_notice_hours` becomes `requested` and `owner_ack_status = approval_needed`.
- A booking creates exactly one owner SMS placeholder with `provider = not_connected`, `status = would_send`, and `cost_status = estimated_not_billed`.
- The owner notification feed `owner_list_notifications` returns that placeholder to owner/developer roles without app-fee ledger rows, payment placeholders, stored claim hashes, or raw provider sends.
- A booking creates a payment placeholder with `live_mode = false` and `routing_status = ledger_only`.
- A booking creates a hidden app-fee ledger entry with `visible_to_customer = false`.
- A blocked full day rejects booking.
- A blocked time slot rejects booking.
- An overlapping active booking rejects booking.
- The database has `bookings_no_active_overlap`, so overlapping active bookings are rejected even under concurrent requests.
- A time outside working hours rejects booking.

## Customer Account Checks

- A new Supabase Auth customer automatically gets a `profiles` row with role `customer`.
- Customer A can claim a guest booking only with the matching raw claim token.
- Claiming a guest booking attaches prior booking messages to Customer A's profile and writes `guest_booking_claimed` to the safe timeline.
- Customer A can read/manage only claimed Customer A bookings.
- Customer A can list claimed bookings through `get_customer_bookings` without stored claim hashes, raw auth user IDs, app-fee ledger rows, payment placeholder internals, or SMS queue rows.
- Customer A can read claimed booking history through `get_booking_timeline`.
- Customer A can load their profile through `get_my_customer_profile`, including saved vehicles from claimed guest bookings.
- Customer A can update their name, phone, and notification preference through `upsert_my_customer_profile`.
- Customer A can add/update/delete their own saved vehicles through `upsert_my_vehicle` and `delete_my_vehicle`.
- Customer A cannot read Customer B bookings.
- Customer B cannot see Customer A bookings in `get_customer_bookings`.
- Customer A cannot call owner RPCs.
- Customer A cannot call developer RPCs.
- Customer A can send an in-app booking message for an accessible booking.
- Customer message creates a message row and owner SMS placeholder, but sends no live SMS.
- Customer cancellation records a cancellation outcome.
- Customer reschedule enforces cutoff, blocked days/times, overlap, and working hours.
- Customer cannot self-reschedule a short-notice request online.

## Owner Checks

- Dane owner can see jobs, availability blocks, owner acknowledgments, messages, and operational status events.
- Dane owner can load the operational job queue through `owner_list_jobs`.
- Dane owner can load safe booking timeline history through `get_booking_timeline`.
- `owner_list_jobs` includes job status, customer contact, message count, and owner SMS placeholder status without returning app-fee ledger rows or payment placeholder internals.
- Dane owner can load the notification inbox through `owner_list_notifications`.
- `owner_list_notifications` includes SMS placeholder status, cost estimate, cost status, body preview, action-required flag, and safe booking context without returning app-fee ledger rows or payment placeholder internals.
- Dane owner can load report summaries through `owner_get_report_snapshot`.
- `owner_get_report_snapshot` includes booking totals, closeout adjustments, cash collected, refund-needed amounts, online paid amount, cash balance due, card fee, hidden app fee, SMS estimate, BrandNew net estimate, forfeited deposits, and ledger-only routing without returning Stripe IDs, claim tokens, or raw provider fields.
- Dane owner can acknowledge a normal confirmed booking.
- Dane owner can close out a confirmed booking through `owner_closeout_booking` with owner adjustment, cash collected, remaining balance, or refund-needed status.
- Closeout records refund-needed as manual review only; it does not attempt a Stripe refund or capture.
- Dane owner can confirm a short-notice request.
- Dane owner can decline a short-notice request.
- Dane owner can request a different time.
- Dane owner can update tracker status to `on_my_way`, `arrived`, and `complete`.
- Dane owner can create and remove full-day blocks.
- Dane owner can create and remove time-slot blocks.
- Dane owner cannot update developer-only pricing, deposit, card fee, app fee, Stripe, or SMS provider settings.

## Developer Checks

- Tim developer can update a service title, price, duration, buffer, and visibility.
- Tim developer can load the developer admin snapshot for service pricing, developer money settings, integration readiness, and live-mode lock status.
- The developer admin snapshot does not expose bookings, claim tokens, payment placeholder internals, or SMS queue rows.
- Tim developer can load `developer_get_launch_readiness` and it returns `repo_ready_requires_live_verification`, `free_path = true`, locked live Stripe, and `sms_provider = not_connected`.
- Dane owner and normal customers cannot load `developer_get_launch_readiness`.
- Tim developer can update deposit amount.
- Tim developer can update the hidden `$3.00` app-fee setting.
- Tim developer can update customer-paid card-processing settings.
- Tim developer can update integration readiness statuses that are allowed.
- Tim developer cannot unlock `stripe_live_mode` through the current RPC.
- Tim developer cannot activate a real SMS provider through the current RPC.
- Tim developer can assign Dane to `owner`.
- Tim developer cannot remove his own developer role through the role RPC.
- Dane owner and normal customers cannot load the developer admin snapshot.

## Frontend Cutover Gate

Only after the checks above pass:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_USE_SUPABASE=false
```

Keep `VITE_USE_SUPABASE=false` until the app can read public services/settings and create a test guest booking through the adapter. Then turn it on in a test deployment first, not the customer-facing URL.

## Still Not Approved By This Checklist

Passing this checklist does not approve:

- Live Stripe charges
- Stripe Connect payout routing
- Live SMS sends
- Paid map/routing/geocoding APIs
- Service-role key use in the frontend
- Real customer launch without Tim/Dane reviewing business copy and policies
