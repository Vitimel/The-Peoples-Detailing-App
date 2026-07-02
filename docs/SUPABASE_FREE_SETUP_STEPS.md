# Supabase Free Setup Steps

**Status:** instructions only. Do not store private keys in this repo.

## What Tim Needs To Create

Create one Supabase Free project for The Peoples Detailing when ready. Use an account Tim/Dane agree should own the business data.

## Apply Repo Backend

Run these SQL files in order through Supabase SQL Editor or Supabase CLI:

1. `supabase/migrations/20260525161000_backend_foundation.sql`
2. `supabase/migrations/20260702130000_booking_rpc_validation.sql`
3. `supabase/migrations/20260702143000_owner_operations_rpc.sql`
4. `supabase/migrations/20260702150000_customer_lifecycle_rpc.sql`
5. `supabase/migrations/20260702153000_developer_admin_rpc.sql`
6. `supabase/migrations/20260702160000_auth_role_hardening.sql`
7. `supabase/migrations/20260702170000_guest_claim_token_contract.sql`
8. `supabase/migrations/20260702175000_booking_overlap_constraint.sql`
9. `supabase/migrations/20260702180000_customer_booking_read_rpc.sql`
10. `supabase/migrations/20260702185000_owner_job_read_rpc.sql`
11. `supabase/migrations/20260702190000_developer_admin_read_rpc.sql`
12. `supabase/migrations/20260702191000_public_availability_read_rpc.sql`
13. `supabase/migrations/20260702192000_customer_booking_list_rpc.sql`
14. `supabase/migrations/20260702193000_owner_notification_read_rpc.sql`
15. `supabase/migrations/20260702194000_customer_profile_vehicle_rpc.sql`
16. `supabase/migrations/20260702195000_owner_reports_read_rpc.sql`
17. `supabase/migrations/20260702200000_owner_closeout_rpc.sql`
18. `supabase/migrations/20260702201000_booking_timeline_read_rpc.sql`
19. `supabase/migrations/20260702202000_guest_claim_audit_rpc.sql`
20. `supabase/migrations/20260702203000_developer_launch_readiness_rpc.sql`
21. `supabase/seed.sql`

## First Developer Bootstrap

After Tim creates/signs into the first Supabase Auth account, manually set that user's `public.profiles.role` to `developer` in Supabase SQL Editor. After that first bootstrap, use the app-role RPC to assign Dane as `owner` and any future admins as `developer`.

Do not put a service-role key in the frontend app.

## Frontend Environment Variables

Only the public anon key belongs in frontend hosting:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_USE_SUPABASE=false
```

Keep `VITE_USE_SUPABASE=false` until Auth/RLS is tested. Never add the Supabase service-role key to GitHub Pages, `.env`, or committed files.

When Auth is wired later, pass the signed-in user's Supabase access token into the adapter for customer, owner, and developer RPCs. Public/guest reads and guest booking can still use the anon key.

The repo has a lightweight Supabase Auth REST adapter contract for email sign-up, password sign-in, user lookup, and sign-out. Keep it disabled until the API/RLS checklist passes.

## First Live Verification

Start with the repo smoke check:

```sql
supabase/verification/live_smoke_checks.sql
```

Then complete the API/RLS checklist in `docs/SUPABASE_LIVE_VERIFICATION_CHECKLIST.md`. The fastest repeatable check is:

```powershell
npm run verify:supabase-api
```

The API/RLS runner needs Supabase URL, anon key, and four test account credentials as environment variables. The SQL Editor check is only a preflight because elevated SQL roles can bypass the same permissions customers, owners, and developers use through the app.

Before storing real customer data:

- Confirm public services can be read.
- Confirm anonymous guest booking can call `create_guest_booking`.
- Confirm the frontend Supabase adapter maps service/settings/booking rows into the same shapes used by the localStorage app.
- Confirm blocked days/times are enforced by the RPC.
- Confirm public availability can be read through `get_public_availability` without exposing owner reasons or customer data.
- Confirm overlapping active bookings are rejected by the RPC.
- Confirm short-notice bookings become `requested`.
- Confirm owner/developer roles can acknowledge confirmed bookings.
- Confirm owner/developer roles can confirm or decline `requested` bookings.
- Confirm owner/developer roles can close out jobs with adjustments, cash collected, balance due, and refund-needed status without live Stripe calls.
- Confirm owner/developer roles can add/remove availability blocks.
- Confirm non-owner customers cannot call owner operation RPCs.
- Confirm claimed customers or guest claim-token users can cancel eligible active bookings.
- Confirm claimed customers or guest claim-token users can read safe booking history through `get_booking_timeline`.
- Confirm customer reschedules enforce cutoff, blocked times, and overlap rules.
- Confirm short-notice requests cannot be self-rescheduled online by the customer.
- Confirm booking messages create in-app records and owner SMS placeholders without sending live SMS.
- Confirm owner/developer roles can load owner notification placeholders through `owner_list_notifications`.
- Confirm owner/developer roles can load ledger-only report summaries through `owner_get_report_snapshot`.
- Confirm developer role can update service prices/durations and developer money settings.
- Confirm developer role can load the developer admin snapshot.
- Confirm developer role can load the launch readiness snapshot through `developer_get_launch_readiness`.
- Confirm non-developer users cannot load the developer admin snapshot.
- Confirm non-developer users cannot load the launch readiness snapshot.
- Confirm non-developer users cannot call developer admin RPCs.
- Confirm developer admin RPCs reject Stripe live mode unlock and real SMS provider activation.
- Confirm new Supabase Auth users automatically get a `profiles` row with role `customer`.
- Confirm developer role assignment can set Dane to `owner`.
- Confirm a developer cannot remove their own developer role through the RPC.
- Confirm a signed-in customer can claim only a booking with the matching claim token.
- Confirm claiming a guest booking attaches prior booking messages to the customer profile and writes a safe timeline event.
- Confirm a signed-in customer can list only their own claimed bookings through `get_customer_bookings`.
- Confirm a signed-in customer can load/update their customer profile and manage saved vehicles through the customer profile RPCs.
- Confirm owner/developer roles can manage operational/admin tables.
- Confirm a normal customer cannot read another customer's booking.

## Still Free At This Stage

This setup can stay on Supabase Free and GitHub Pages. Stripe live payments, SMS provider sends, paid maps, and custom domains remain separate future decisions.
