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

`supabase/seed.sql` seeds the current service packages, launch settings, and integration status rows for a fresh project.

## Frontend Adapter Contract

`src/data/appDataLayer.js` keeps localStorage active, but now has a disabled Supabase REST adapter that is shaped like the future live data source.

`src/data/supabaseMappings.js` handles the translation boundary:

- service rows become app services with `priceCents`, `durationHours`, service copy, and buffer metadata.
- `business_settings` rows become app settings such as `minimumBookingNoticeHours`, `workingHoursEnd`, and `bookingSubmissionMode`.
- booking rows become app bookings with `serviceId`, `startIso`, guest/profile fields, short-notice status, owner acknowledgment state, tracker fields, and payment/cancellation status fields.
- availability block rows become owner scheduling blocks with `type`, `date`, `timeLabel`, and reason.
- message rows become in-app message records with booking, audience, direction, body, and timestamp.
- app booking drafts become the safe `create_guest_booking(payload jsonb)` RPC payload.
- owner actions call the future `owner_*` RPCs rather than writing raw table rows directly.
- customer lifecycle actions call cancellation, reschedule, and message RPCs with either auth ownership or a guest claim token.
- developer admin actions call service, business-setting, and integration-status RPCs that require the developer role.
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
