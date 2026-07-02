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
7. `supabase/seed.sql`

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

## First Live Verification

Before storing real customer data:

- Confirm public services can be read.
- Confirm anonymous guest booking can call `create_guest_booking`.
- Confirm the frontend Supabase adapter maps service/settings/booking rows into the same shapes used by the localStorage app.
- Confirm blocked days/times are enforced by the RPC.
- Confirm overlapping active bookings are rejected by the RPC.
- Confirm short-notice bookings become `requested`.
- Confirm owner/developer roles can acknowledge confirmed bookings.
- Confirm owner/developer roles can confirm or decline `requested` bookings.
- Confirm owner/developer roles can add/remove availability blocks.
- Confirm non-owner customers cannot call owner operation RPCs.
- Confirm claimed customers or guest claim-token users can cancel eligible active bookings.
- Confirm customer reschedules enforce cutoff, blocked times, and overlap rules.
- Confirm short-notice requests cannot be self-rescheduled online by the customer.
- Confirm booking messages create in-app records and owner SMS placeholders without sending live SMS.
- Confirm developer role can update service prices/durations and developer money settings.
- Confirm non-developer users cannot call developer admin RPCs.
- Confirm developer admin RPCs reject Stripe live mode unlock and real SMS provider activation.
- Confirm new Supabase Auth users automatically get a `profiles` row with role `customer`.
- Confirm developer role assignment can set Dane to `owner`.
- Confirm a developer cannot remove their own developer role through the RPC.
- Confirm a signed-in customer can claim only a booking with the matching claim token.
- Confirm owner/developer roles can manage operational/admin tables.
- Confirm a normal customer cannot read another customer's booking.

## Still Free At This Stage

This setup can stay on Supabase Free and GitHub Pages. Stripe live payments, SMS provider sends, paid maps, and custom domains remain separate future decisions.
