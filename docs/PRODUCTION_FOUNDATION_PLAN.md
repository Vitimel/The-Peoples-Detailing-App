# Production Foundation Plan

**Date:** 2026-05-25

This note captures the approved direction after the free MVP preview: use a no-monthly-cost production-shaped backend first, and teach/verify Stripe test mode before any live payment work.

## Current Release Boundary

- The public app remains a static GitHub Pages preview.
- Browser localStorage remains the working demo data store.
- NHTSA vPIC VIN lookup remains the only connected external API.
- No production Stripe, SMS, email, maps/routing, reverse geocoding, auth, database, calendar sync, or live tracking is connected.

## Backend Direction

Use Supabase Free as the default backend candidate for the finished product because it provides:

- Postgres database tables for bookings, customers, services, vehicles, settings, status events, and ledger records.
- Auth for future owner/developer/customer access.
- Storage and Edge Functions if later needed.
- A free tier suitable for MVP exploration, with usage limits to watch.

Keep the frontend deploy on GitHub Pages until the app needs server-rendered routes or a different deployment target.

## Backend Guardrails

- Do not store Supabase service-role keys or private secrets in the frontend repo.
- Do not store real customer data until Row Level Security policies are designed, enabled, and tested.
- Keep localStorage as a demo fallback until the Supabase-backed path is verified.
- Treat backend setup as a separate approved work item from today's free preview release.

## Payments Learning Gate

Stripe test mode or sandboxes can simulate payments without moving real money. Live mode is different: it charges real cards, requires live API keys, bank/business setup, secure webhook handling, and Stripe transaction fees.

Before implementing payment code:

- Explain Stripe test mode to Tim/Dane in plain language.
- Decide whether real customers pay before owner approval or after owner approval.
- Decide whether the first real payment is a full card payment, deposit only, or payment link/manual invoice.
- Keep the $3 BrandNew app cost ledger-only until Stripe Connect/backend routing is explicitly approved.

## Useful Official References

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Supabase pricing: https://supabase.com/pricing
- Stripe test mode: https://docs.stripe.com/testing-use-cases
- Stripe pricing: https://stripe.com/pricing
