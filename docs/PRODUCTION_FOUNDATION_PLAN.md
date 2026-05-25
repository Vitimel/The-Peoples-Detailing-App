# Production Foundation Plan

**Date:** 2026-05-25

This note captures the approved direction after the free MVP preview: use a no-monthly-cost production-shaped backend first, hold open slots immediately when customers book, notify Dane, and teach/verify Stripe test mode before any live payment work.

## Current Release Boundary

- The public app remains a static GitHub Pages preview.
- Browser localStorage remains the working demo data store.
- A backend-ready local data adapter is in place, and Supabase remains scaffolded/planned but disabled until credentials, Auth, and RLS are approved.
- Public access is route-based in one app: `/` for customer booking, `/owner` for Dane operations, and `/developer` for Tim/BrandNew setup.
- Customers can choose future profile setup at booking start or continue as guest. Guest bookings can later be claimed by a Supabase Auth profile.
- The role switcher and Reset Demo controls are hidden from normal public URLs and remain available only through `?demo=1`.
- Customer bookings are intended to become confirmed slot reservations immediately when the time is open.
- Owner acknowledgment is tracked separately from booking status.
- NHTSA vPIC VIN lookup remains the only connected external API.
- No production Stripe, SMS, email, maps/routing, reverse geocoding, auth, database, calendar sync, or live tracking is connected.
- New local bookings create production-shaped records for future payments, owner SMS queueing, status events, owner acknowledgment, and BrandNew app-fee ledger reconciliation.

## Backend Direction

Use Supabase Free as the default backend candidate for the finished product because it provides:

- Postgres database tables for bookings, customers, services, vehicles, settings, status events, and ledger records.
- Auth for future owner/developer/customer access.
- Storage and Edge Functions if later needed.
- A free tier suitable for MVP exploration, with usage limits to watch.

Keep the frontend deploy on GitHub Pages until the app needs server-rendered routes or a different deployment target.

The production booking write must reserve the selected slot atomically so two customers cannot take the same time.

Future Row Level Security should line up with the frontend routes:

- `customer`: create bookings and read/update only their own bookings, vehicles, messages, and allowed profile data.
- `owner`: manage jobs, acknowledgments, availability, blocked days/times, operational settings, reports, and customer support workflows.
- `developer`: manage service pricing, deposit/app/card-fee settings, booking submit mode, integrations, and environment setup.

## Backend Guardrails

- Do not store Supabase service-role keys or private secrets in the frontend repo.
- Do not store real customer data until Row Level Security policies are designed, enabled, and tested.
- Keep localStorage as a demo fallback until the Supabase-backed path is verified.
- Treat backend setup as a separate approved work item from today's free preview release.
- The current local adapter should be treated as a schema rehearsal only; the production write still needs server-side slot reservation.
- A repo-ready migration now defines the intended Supabase tables, RLS policies, and guest booking RPC stub, but it has not been applied to a live project.

## Payments Learning Gate

Stripe test mode or sandboxes can simulate payments without moving real money. Live mode is different: it charges real cards, requires live API keys, bank/business setup, secure webhook handling, and Stripe transaction fees.

Before implementing payment code:

- Explain Stripe test mode to Tim/Dane in plain language.
- Decide whether real customers pay before owner approval or after owner approval.
- Decide whether the first real payment is a full card payment, deposit only, or payment link/manual invoice.
- Keep the $3 BrandNew app cost ledger-only until Stripe Connect/backend routing is explicitly approved.
- The app now records future Stripe fields locally: Checkout Session ID, PaymentIntent ID, connected account ID, `application_fee_amount`, deposit, card fee, and routing status. Those fields stay empty/ledger-only until Stripe test mode is approved.

## Notification Direction

Dane should receive a real SMS when a customer books. The first production SMS flow should be:

- Customer books an available time.
- Backend creates the confirmed booking and sends Dane an SMS.
- Dane acknowledges from the owner app or by a future SMS reply.
- If the time somehow does not work, Dane can mark `reschedule_requested` and message the customer.

Do not put SMS provider secrets in the frontend.

Current near-live preview behavior:

- Booking/request creation adds a local owner SMS queue record.
- Owner notifications show that SMS would be sent to Dane, with an estimated not-billed cost.
- SMS cost estimates are reconciled against BrandNew's hidden `$3.00` app-fee ledger, but no provider is called and no SMS bill is created.

## Useful Official References

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Supabase pricing: https://supabase.com/pricing
- Stripe test mode: https://docs.stripe.com/testing-use-cases
- Stripe pricing: https://stripe.com/pricing
