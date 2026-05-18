# Usable App ASAP Plan

**Date:** 2026-05-18  
**Goal:** make The Peoples Detailing app useful as quickly as possible without jumping into risky production Stripe, SMS, maps, auth, or backend work before approval.

## Current State

The app is a Vite + React frontend prototype with localStorage mock data. It has working customer and owner flows, preserved source-of-truth design, and automated test coverage.

Verified on 2026-05-18:

- Unit tests: 9 passed.
- Production build: passed.
- Playwright smoke tests: 18 passed across desktop and mobile Chromium.

## Fastest Safe Usable Version

The fastest usable version is a hosted preview/demo that Dane and Tim can click on phones and desktops.

This version can be used for:

- showing the booking experience;
- confirming services, prices, app fee, travel fee, and checkout language;
- reviewing the saved vehicle flow;
- reviewing the owner dashboard/tracker/settings experience;
- collecting feedback before real payment, notifications, auth, or backend work.

This version should not be used as a real production booking system unless Tim and Dane accept that it is frontend/localStorage only.

## What Makes It "Usable" First

Phase 1 should aim for a public or private preview URL with clear expectations:

1. Hosted static app preview.
2. Clear demo/localStorage boundary.
3. Verified phone-width layout.
4. Approved checkout language.
5. Approved service/pricing details.
6. Approved contact path for real booking requests.
7. Archived working release before major production refactor.

## Recommended Manual Booking Bridge

Before adding a backend, use the app as a sales/demo surface and route real customers to a manual booking channel:

- phone call;
- text message;
- existing business contact method;
- simple external form if Tim approves one later.

Do not silently add production SMS, payment, database, auth, calendar, maps/routing, or reverse geocoding.

## Shortest Technical Path

1. Merge the current branch into `main`.
2. Enable GitHub Pages for the repo if it is not already enabled.
3. Let the Pages workflow deploy the `dist` build.
4. Open the deployed URL on phone and desktop.
5. Run the manual visual QA checklist.
6. Create a Git tag/release for the first working hosted preview.

## Before Real Customers

Confirm with Tim/Dane:

- final services and prices;
- public phone number/contact method;
- whether the app should say "request booking" instead of implying final confirmed payment;
- cancellation/reschedule rules;
- travel fee rules;
- privacy language for location;
- whether payments happen before owner approval or after approval;
- whether customers need accounts for MVP.

## Production Features That Need Explicit Approval

- Stripe or other payment integration.
- SMS/text provider.
- Email delivery service.
- Backend/database.
- User auth/accounts.
- Google Calendar or calendar sync.
- Maps/routing.
- Reverse geocoding/address validation.
- Live tracking.

## Current Deployment Note

This repo has a GitHub Pages workflow on the current branch. GitHub Pages does not appear enabled yet for `Vitimel/The-Peoples-Detailing-App` as of this check. After the Pages workflow is merged to `main`, enable Pages using GitHub Actions as the source.

