# The Peoples Detailing App Prototype

This is a Vite + React conversion of the approved one-file Codex build-packet prototype for **The Peoples Detailing**.

The protected source-of-truth prototype is preserved at:

- `docs/peoples_detailing_app_SOURCE_OF_TRUTH.html`

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Vite serves the app at the local URL printed by the command, usually `http://127.0.0.1:5173`.

## Test

```bash
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

The unit tests cover the fee rules directly. Vitest is configured to collect only unit tests and exclude `tests/e2e/**`. The Playwright smoke tests run only with `npm run test:e2e` and cover load, home, service selection, booking flow, checkout fee lines, promo carry-through, saved vehicle carry-through, BrandNew attribution, owner settings, tracker statuses, bottom navigation, and a mobile project.

The latest verification pass also captured review screenshots in `docs/qa-screenshots/`.

## Preserved From The Packet

- The Peoples Detailing branding, colors, phone-shell layout, logo, and customer/owner prototype structure.
- Service packages and pricing from the source prototype.
- App fee rule: flat $3.00 customer-visible app fee by default.
- Company-covered card processing fee by default, with owner setting to show it to the customer later.
- Checkout lines for service price, travel fee, discount, app fee, card processing fee, and total due today.
- No-surprise-charges language.
- BrandNew Design attribution inside the app fee information area.
- Simple saved vehicle flow with optional VIN/year/make/model/trim/color/plate details.
- MVP status labels: On the Way, I'm Here, Completed.
- Owner SMS/customer email notification assumptions documented in settings and handoff notes.
- Mock/localStorage mode only. Browser GPS can be requested for estimated distance, with demo fallback if permission is blocked. No real Stripe, SMS, backend, auth, reverse geocoding, maps, routing, or calendar integration was added.

## Small Adjustment Made During Conversion

The original prototype saved promo and vehicle data into the booking object, but confirmation/detail screens did not visibly show both. This conversion adds a small confirmation/detail display for saved vehicle and promo code so the documented handoff behavior can be reviewed and tested.

## Structure

- `src/screens/PrototypeApp.jsx` - faithful converted prototype screen flow.
- `src/assets/` - local packet asset copy, including the primary crest logo.
- `src/styles/` - Tailwind entry and extracted prototype CSS.
- `src/data/prototypeState.js` - mock services, settings, vehicles, bookings, storage helpers, and format helpers from the source prototype.
- `src/utils/fees.js` - testable fee calculation helpers.
- `src/utils/format.js` - shared formatting helpers for future cleanup.
- `src/data/projectDecisions.js` - durable MVP decisions preserved from the packet.
- `tests/fees.test.js` - unit tests for checkout math.
- `tests/e2e/app-smoke.spec.js` - Playwright smoke tests for core flows.
- `docs/HANDOFF_NOTES.md` - cross-agent handoff notes for Tim/Mac/Claude.
- `docs/FINAL_VERIFICATION_REPORT.md` - latest verification results.
- `docs/TEST_REPORT.md` - concise command and test summary.
- `docs/MANUAL_VISUAL_QA_CHECKLIST.md` - manual click-test and visual approval checklist.

## Still Needs Human Review

- Final visual review against the original HTML source and packet screenshots on desktop and phone widths.
- Copy review for any text inherited from the prototype that should be polished before production.
- Confirm whether browser GPS distance estimation is enough for MVP or whether paid/free-tier maps and address validation should be planned later.
- Later production implementation of Stripe, calendar, SMS/email, auth, backend storage, privacy, and deployment.
