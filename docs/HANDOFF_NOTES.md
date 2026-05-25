# Handoff Notes

## Source Of Truth

The approved one-file prototype from the Codex build packet is preserved as:

`docs/peoples_detailing_app_SOURCE_OF_TRUTH.html`

Do not replace it with older backups from the packet.

## What Changed

- Converted the source prototype from CDN React/Babel/Tailwind into a Vite + React project.
- Replaced the embedded base64 logo with the local crest logo asset from the packet.
- Preserved the phone-shell visual layout and the customer/owner clickable flows.
- Extracted fee calculations into `src/utils/fees.js` for direct testing.
- Added Vitest unit tests and Playwright smoke tests.
- Added visible confirmation/detail display for selected saved vehicle and promo code.

## Preserved Business Rules

- App fee: flat $3.00 hidden from customer checkout and tracked as a Dane-side ledger cost on each online purchase or deposit.
- Customer pays card processing on the amount paid online today by default.
- Checkout shows service price, travel fee, discount, card processing fee, and total due today.
- BrandNew attribution remains secondary in owner/reporting context for the app-fee ledger item.
- Saved vehicle flow is simple; nickname is enough, exact vehicle details are optional.
- MVP status notifications are On the Way, I'm Here, and Completed.
- Owner SMS and customer email/controlled SMS assumptions remain in the mock settings.
- Browser GPS distance estimation was added with a demo fallback. No backend, payment, maps/routing, reverse geocoding, calendar, SMS, or auth production integration was added.

## Cross-Agent Notes

- Treat this as the first runnable React handoff, not a production backend build.
- Keep changes scoped until visual parity is approved by Tim/Mac/Claude.
- Archive a known-good release before large future refactors.
- Future cleanup can move primitives from `src/screens/PrototypeApp.jsx` into `src/components/`, but do that after visual review.

## Manual Review Checklist

- Run `npm install`, `npm run dev`, and open the local Vite URL.
- Click customer flow: splash, home, service detail, booking, location, checkout, confirmation, booking detail, profile, vehicles, messages.
- Click owner flow: dashboard, jobs, job detail, tracker, reports, services, settings.
- Confirm checkout fee lines and totals match the tests.
- Verify checkout hides the $3 app fee and shows customer-paid card processing by default.
- Apply `PEOPLES10` and confirm promo appears after booking.
- Save a vehicle such as `White F-150` and confirm it carries into booking/confirmation.
- Check desktop and mobile widths for obvious layout breaks.
