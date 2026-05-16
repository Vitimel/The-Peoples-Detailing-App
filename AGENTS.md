# AGENTS.md

This repo is for The Peoples Detailing booking app prototype conversion.

The source-of-truth prototype is `docs/peoples_detailing_app_SOURCE_OF_TRUTH.html`.

Preserve:

- The Peoples Detailing as the primary brand.
- App fee: flat $3.00 customer-visible fee by default.
- Company-covered card processing fee by default, with owner settings available if it should be shown to customers later.
- Checkout fee breakdown and no-surprise language.
- Saved vehicle flow with required nickname/basic name and optional exact details.
- MVP statuses: On the Way, I'm Here, Completed.
- Tasteful BrandNew attribution in the app-fee info area.

Do not add production Stripe, SMS, maps/routing, reverse geocoding, auth, or backend behavior without explicit approval.

Archive a working release before major future refactors.
