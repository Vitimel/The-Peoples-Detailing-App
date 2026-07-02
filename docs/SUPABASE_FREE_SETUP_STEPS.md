# Supabase Free Setup Steps

**Status:** instructions only. Do not store private keys in this repo.

## What Tim Needs To Create

Create one Supabase Free project for The Peoples Detailing when ready. Use an account Tim/Dane agree should own the business data.

## Apply Repo Backend

Run these SQL files in order through Supabase SQL Editor or Supabase CLI:

1. `supabase/migrations/20260525161000_backend_foundation.sql`
2. `supabase/migrations/20260702130000_booking_rpc_validation.sql`
3. `supabase/seed.sql`

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
- Confirm a signed-in customer can claim only a booking with the matching claim token.
- Confirm owner/developer roles can manage operational/admin tables.
- Confirm a normal customer cannot read another customer's booking.

## Still Free At This Stage

This setup can stay on Supabase Free and GitHub Pages. Stripe live payments, SMS provider sends, paid maps, and custom domains remain separate future decisions.
