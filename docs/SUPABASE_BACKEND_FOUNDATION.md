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

## Security Direction

- RLS is enabled on every table.
- Guest booking should happen only through a safe server-side function.
- Signed-in customers can read/manage claimed bookings later.
- Owner can manage jobs, availability, messaging, and reports.
- Developer can manage pricing, app/card/deposit settings, and integrations.
- No service-role key belongs in the frontend repo.

## Current Boundary

- localStorage remains active.
- Supabase is planned/disabled.
- Stripe test mode is planned but not connected.
- Stripe live mode is locked.
- SMS is queued locally only; no provider is called.
