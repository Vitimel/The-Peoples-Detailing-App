# Supabase Backend Foundation

Status: repo-ready only. No live Supabase project is connected.

## Customer Access

- Customers can start with `Sign in / Create profile` or `Continue as guest`.
- Guest booking is the default low-friction path.
- Confirmation offers `Save my info for next time` or `No thanks`.
- Saving info only marks a future claim/profile intent in this preview. Real Supabase Auth is not connected.

## Schema Shape

The migration in `supabase/migrations/20260525161000_backend_foundation.sql` prepares:

- `profiles` for Supabase users and app roles.
- `customer_profiles` and `vehicles` for repeat customers.
- `bookings` with guest fields: `guest_name`, `guest_phone`, `guest_vehicle_label`, `claim_token_hash`, `claimed_by_user_id`, and `claimed_at`.
- operational tables for availability, messages, owner acknowledgments, status events, payment placeholders, app-fee ledger entries, SMS queue entries, and integration status.

The follow-up migration in `supabase/migrations/20260702130000_booking_rpc_validation.sql` adds the production-shaped booking RPC and validation layer:

- `business_settings` for launch-critical scheduling/payment defaults.
- service duration and buffer columns.
- server-side validation for working hours, blocked days/times, overlapping active bookings, short-notice requests, and required address fields.
- transactional creation of owner acknowledgment, status event, payment placeholder, app-fee ledger, and SMS queue records.
- `claim_guest_booking` for the future signed-in customer claim flow.

The owner operation migration in `supabase/migrations/20260702143000_owner_operations_rpc.sql` adds role-gated RPCs for:

- acknowledging confirmed bookings.
- confirming or declining short-notice booking requests.
- marking owner-requested reschedules.
- updating MVP tracker status: `on_my_way`, `arrived`, and `complete`.
- creating/removing full-day and time-slot availability blocks.

The customer lifecycle migration in `supabase/migrations/20260702150000_customer_lifecycle_rpc.sql` adds access-checked RPCs for:

- customer/guest cancellation with no-payment, refundable, or deposit-forfeit outcomes.
- customer/owner rescheduling with slot validation, blocked time enforcement, overlap checks, short-notice restrictions, and customer cutoff enforcement.
- in-app booking messages that can queue a local owner SMS placeholder without sending a live SMS.

The developer admin migration in `supabase/migrations/20260702153000_developer_admin_rpc.sql` adds developer-only RPCs for:

- updating service title, price, duration, buffer, and visibility.
- updating developer money settings such as booking mode, deposit, hidden app fee, card-processing settings, and SMS estimate.
- updating integration readiness rows while refusing to unlock Stripe live mode or real SMS provider activation without separate approval.

The Auth/RLS hardening migration in `supabase/migrations/20260702160000_auth_role_hardening.sql` adds:

- security-definer role helpers for RLS checks.
- automatic `profiles` row creation when Supabase Auth creates a user.
- developer-only app-role assignment for setting customer, owner, or developer roles after the first developer is manually bootstrapped.
- a guard that prevents a developer from removing their own developer role.

The guest claim-token migration in `supabase/migrations/20260702170000_guest_claim_token_contract.sql` adds:

- a one-time raw `claim_token` returned by `create_guest_booking` for the guest confirmation/save-profile flow.
- hashed claim-token storage in `bookings.claim_token_hash`, so the raw token is not stored in the database.
- claim-token matching for future guest cancellation, reschedule, message, and account-claim RPCs.

The guest claim audit migration in `supabase/migrations/20260702202000_guest_claim_audit_rpc.sql` adds:

- a hardened `claim_guest_booking` handoff for signed-in customers with the matching raw claim token.
- attachment of any earlier guest booking messages to the customer profile.
- default-vehicle/profile preservation when the guest booking is saved into an account.
- a `guest_booking_claimed` status event so the safe booking timeline records the account handoff.

The customer booking read migration in `supabase/migrations/20260702180000_customer_booking_read_rpc.sql` adds:

- `get_customer_booking` for claimed users, staff, or guests with the raw claim token.
- `get_customer_booking_messages` for the same access paths.
- customer-safe JSON responses that avoid staff-only payment placeholders, app-fee ledger rows, SMS queue records, stored claim hashes, and raw auth user IDs.

The booking overlap constraint migration in `supabase/migrations/20260702175000_booking_overlap_constraint.sql` adds:

- `bookings.end_at`, generated from service duration and buffer by a database trigger.
- a check that every booking ends after it starts.
- a GiST exclusion constraint that rejects overlapping `requested` or `confirmed` bookings even if two requests arrive at the same time.

The owner job read migration in `supabase/migrations/20260702185000_owner_job_read_rpc.sql` adds:

- `owner_list_jobs` for owner/developer job queues.
- operational fields Dane needs: customer contact, address, status, owner acknowledgment, tracker state, message count, and owner SMS placeholder status.
- no app-fee ledger rows, Stripe/payment placeholder internals, stored claim hashes, or developer-only settings.

The developer admin read migration in `supabase/migrations/20260702190000_developer_admin_read_rpc.sql` adds:

- `developer_get_admin_snapshot` for Tim/BrandNew admin setup screens.
- developer-only service pricing/duration data, developer money settings, integration readiness, and live-mode lock status.
- no booking/customer PII, payment placeholder internals, SMS queue rows, or stored claim tokens.

The public availability read migration in `supabase/migrations/20260702191000_public_availability_read_rpc.sql` adds:

- `get_public_availability` for the customer calendar.
- customer-safe unavailable slots from manual owner blocks plus active `requested`/`confirmed` bookings.
- no owner block reasons, customer contact details, claim tokens, payment records, or SMS records.

The customer booking list migration in `supabase/migrations/20260702192000_customer_booking_list_rpc.sql` adds:

- `get_customer_bookings` for signed-in customer booking history.
- only bookings claimed by the current Supabase Auth user.
- the same customer-safe booking shape as the single booking read, without stored claim hashes, raw auth user IDs, app-fee ledger rows, payment placeholder internals, or SMS queue rows.

The owner notification read migration in `supabase/migrations/20260702193000_owner_notification_read_rpc.sql` adds:

- `owner_list_notifications` for Dane's future owner notification inbox.
- SMS-placeholder status, estimated cost, cost status, preview copy, action-required state, and safe booking context.
- no live SMS sends, app-fee ledger rows, payment placeholder internals, business settings, stored claim hashes, or raw provider secrets.

The customer profile/vehicle migration in `supabase/migrations/20260702194000_customer_profile_vehicle_rpc.sql` adds:

- `get_my_customer_profile` for signed-in customers to load their profile and saved vehicles.
- `upsert_my_customer_profile` for customer-owned name, phone, and notification preference updates.
- `upsert_my_vehicle` and `delete_my_vehicle` for customer-owned saved vehicles with a required nickname and a stable default vehicle.
- no raw profile/vehicle table writes from the frontend and no app-fee, payment, SMS, or provider-secret access.

The owner reports migration in `supabase/migrations/20260702195000_owner_reports_read_rpc.sql` adds:

- `owner_get_report_snapshot` for Dane/Tim report screens.
- booking totals, online paid amount, cash balance due, card-processing fees, hidden app fee, SMS estimate, BrandNew net estimate, forfeited deposits, and ledger-only routing status.
- no Stripe Checkout Session IDs, PaymentIntent IDs, connected account IDs, claim tokens, live SMS sends, or money movement.

The owner closeout migration in `supabase/migrations/20260702200000_owner_closeout_rpc.sql` adds:

- `owner_closeout_booking` for Dane's final job review after service.
- owner adjustment, adjusted job total, cash collected, remaining balance due, refund-needed amount, closeout note, completed job status, and audit status event.
- no live payment capture, Stripe refund, payout routing, SMS send, or paid-provider action.

The booking timeline read migration in `supabase/migrations/20260702201000_booking_timeline_read_rpc.sql` adds:

- `get_booking_timeline` for owners, claimed customers, or guests with the raw claim token.
- safe status-event history ordered oldest to newest.
- no `created_by`, stored claim-token data, app-fee ledger rows, payment placeholder internals, SMS queue rows, or provider secrets.

The developer launch readiness migration in `supabase/migrations/20260702203000_developer_launch_readiness_rpc.sql` adds:

- `developer_get_launch_readiness` for Tim/developer.
- a read-only safety snapshot of expected tables, expected RPCs, RLS-enabled tables, integration status, and business locks.
- explicit no-cost gates before real customer data: migrations, seed, developer bootstrap, SQL smoke checks, API/RLS verifier, and keeping `VITE_USE_SUPABASE=false` until verified.
- no customer booking reads, payment placeholder reads, SMS queue reads, provider calls, or service-role keys.

The checkout quote migration in `supabase/migrations/20260702204000_checkout_quote_rpc.sql` adds:

- `get_checkout_quote` for customer-safe checkout totals before a booking is created.
- server-side service price, travel fee, discount, deposit/full/pay-later choice, card-processing fee, due-today total, balance due, and no-real-payment status.
- no returned hidden BrandNew app-fee amount, payment placeholder internals, app-fee ledger rows, SMS queue rows, or live payment provider calls.

`supabase/seed.sql` seeds the current service packages, launch settings, and integration status rows for a fresh project.

## Frontend Adapter Contract

`src/data/appDataLayer.js` keeps localStorage active, but now has a disabled Supabase REST adapter that is shaped like the future live data source.

The adapter sends the public anon key for guest/public calls and can send a signed-in Supabase user's JWT through `accessToken` or `getAccessToken()` for owner, developer, and claimed-customer RPCs. It does not use or expect a service-role key in frontend code.

`createSupabaseAuthAdapter` is a repo-ready Auth REST contract for future email sign-up, password sign-in, current-user lookup, and sign-out. It uses Supabase Auth endpoints with the public anon key and signed-in user tokens only; it does not make auth live in the preview.

`src/data/supabaseMappings.js` handles the translation boundary:

- service rows become app services with `priceCents`, `durationHours`, service copy, and buffer metadata.
- `business_settings` rows become app settings such as `minimumBookingNoticeHours`, `workingHoursEnd`, and `bookingSubmissionMode`.
- booking rows become app bookings with `serviceId`, `startIso`, guest/profile fields, short-notice status, owner acknowledgment state, tracker fields, and payment/cancellation status fields.
- availability block rows become owner scheduling blocks with `type`, `date`, `timeLabel`, and reason.
- public availability reads use `get_public_availability` so the customer UI can see unavailable slots without raw booking or owner-note access.
- checkout screens can call `get_checkout_quote` so customer totals are calculated by the backend before any future Stripe handoff.
- booking message reads use `get_customer_booking_messages` so owners, claimed customers, and guests with a claim token do not need raw `messages` table access.
- message rows become in-app message records with booking, audience, direction, body, and timestamp.
- booking timeline reads use `get_booking_timeline` so owners, claimed customers, and guests with a claim token can see safe status history without raw `status_events` table access.
- app booking drafts become the safe `create_guest_booking(payload jsonb)` RPC payload.
- guest save-profile flows call `claim_guest_booking` so the backend owns the guest-to-profile handoff instead of the frontend mutating raw booking/profile rows.
- owner actions call the future `owner_*` RPCs rather than writing raw table rows directly.
- owner job dashboards can call `owner_list_jobs` instead of stitching raw tables together in the frontend.
- owner notification screens can call `owner_list_notifications` to show SMS-placeholder alerts without touching raw notification tables.
- owner report screens can call `owner_get_report_snapshot` instead of reading raw payment, ledger, and SMS tables.
- owner closeout screens can call `owner_closeout_booking` instead of directly mutating booking/payment fields.
- customer lifecycle actions call cancellation, reschedule, and message RPCs with either auth ownership or a guest claim token.
- guest and claimed-customer detail screens can call customer-safe read RPCs instead of reading raw tables directly.
- signed-in customer history can call `get_customer_bookings` instead of reading the raw bookings table.
- signed-in customer profile screens can call customer profile/vehicle RPCs instead of reading or writing raw profile tables.
- developer admin actions call service, business-setting, and integration-status RPCs that require the developer role.
- developer admin read screens can call `developer_get_admin_snapshot` instead of reading raw service/settings/integration tables directly.
- developer launch screens can call `developer_get_launch_readiness` to see whether the no-cost backend gates are ready before customer data is allowed.
- developer role assignment calls a dedicated RPC after the first developer has been manually bootstrapped in Supabase.

This keeps the React screens from depending on raw Supabase column names and makes the future cutover easier to test.

## Security Direction

- RLS is enabled on every table.
- Guest booking should happen only through a safe server-side function.
- Signed-in customers can read/manage claimed bookings later.
- Owner can manage jobs, availability, messaging, and reports.
- Developer can manage pricing, app/card/deposit settings, and integrations.
- First developer bootstrap is a manual Supabase setup step; after that, developer RPCs assign owner/developer/customer roles.
- No service-role key belongs in the frontend repo.

## Current Boundary

- localStorage remains active.
- Supabase is repo-ready/disabled.
- Stripe test mode is planned but not connected.
- Stripe live mode is locked.
- SMS is queued locally only; no provider is called.

See `docs/BACKEND_IMPLEMENTATION_STATUS.md` and `docs/SUPABASE_FREE_SETUP_STEPS.md` for the current implementation checkpoint and next live setup steps.
