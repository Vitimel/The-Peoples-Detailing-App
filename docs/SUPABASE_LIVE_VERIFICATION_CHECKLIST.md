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

## Anonymous Customer Checks

- Public services can be read with the anon key.
- Public safe business settings can be read with the anon key.
- Hidden settings are not readable by anon/customer: `company_app_fee_cents`, `owner_sms_estimate_cents`, `sms_provider`, card-processing internals unless intentionally exposed later.
- `create_guest_booking` works with a valid service, future time, address, guest name, phone, and vehicle label.
- `create_guest_booking` returns both `booking_id` and a one-time raw `claim_token`.
- The booking row stores `claim_token_hash`, not the raw `claim_token`.
- The raw `claim_token` can read the booking through `get_customer_booking`.
- The raw `claim_token` can read in-app messages through `get_customer_booking_messages`.
- Customer-safe read RPCs do not return `claim_token_hash`, raw auth user IDs, app-fee ledger rows, payment placeholders, or SMS queue rows.
- A normal future booking becomes `confirmed` and `owner_ack_status = needs_ack`.
- A short-notice booking inside `minimum_booking_notice_hours` becomes `requested` and `owner_ack_status = approval_needed`.
- A booking creates exactly one owner SMS placeholder with `provider = not_connected`, `status = would_send`, and `cost_status = estimated_not_billed`.
- A booking creates a payment placeholder with `live_mode = false` and `routing_status = ledger_only`.
- A booking creates a hidden app-fee ledger entry with `visible_to_customer = false`.
- A blocked full day rejects booking.
- A blocked time slot rejects booking.
- An overlapping active booking rejects booking.
- A time outside working hours rejects booking.

## Customer Account Checks

- A new Supabase Auth customer automatically gets a `profiles` row with role `customer`.
- Customer A can claim a guest booking only with the matching raw claim token.
- Customer A can read/manage only claimed Customer A bookings.
- Customer A cannot read Customer B bookings.
- Customer A cannot call owner RPCs.
- Customer A cannot call developer RPCs.
- Customer A can send an in-app booking message for an accessible booking.
- Customer message creates a message row and owner SMS placeholder, but sends no live SMS.
- Customer cancellation records a cancellation outcome.
- Customer reschedule enforces cutoff, blocked days/times, overlap, and working hours.
- Customer cannot self-reschedule a short-notice request online.

## Owner Checks

- Dane owner can see jobs, availability blocks, owner acknowledgments, messages, and operational status events.
- Dane owner can acknowledge a normal confirmed booking.
- Dane owner can confirm a short-notice request.
- Dane owner can decline a short-notice request.
- Dane owner can request a different time.
- Dane owner can update tracker status to `on_my_way`, `arrived`, and `complete`.
- Dane owner can create and remove full-day blocks.
- Dane owner can create and remove time-slot blocks.
- Dane owner cannot update developer-only pricing, deposit, card fee, app fee, Stripe, or SMS provider settings.

## Developer Checks

- Tim developer can update a service title, price, duration, buffer, and visibility.
- Tim developer can update deposit amount.
- Tim developer can update the hidden `$3.00` app-fee setting.
- Tim developer can update customer-paid card-processing settings.
- Tim developer can update integration readiness statuses that are allowed.
- Tim developer cannot unlock `stripe_live_mode` through the current RPC.
- Tim developer cannot activate a real SMS provider through the current RPC.
- Tim developer can assign Dane to `owner`.
- Tim developer cannot remove his own developer role through the role RPC.

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
