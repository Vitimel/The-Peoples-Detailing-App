# App Function Plan

**Date:** 2026-05-19

This app should behave like a usable localStorage prototype of The Peoples Detailing's real booking process. Every visible action must reflect the business rule behind it, even while payments, SMS, auth, database, routing, and Stripe Connect remain future integrations.

## Current Operating Model

- The app is a Vite/React frontend deployed as a static GitHub Pages preview.
- Data is stored in browser localStorage for demo use only.
- NHTSA vPIC VIN lookup is the only connected external API.
- No production Stripe, SMS, email, auth, backend, database, calendar, maps/routing, reverse geocoding, or automatic payout routing is connected.
- No secret keys or private credentials belong in this GitHub repo or the GitHub Pages frontend.

## Customer Booking Rules

1. Customer selects service, date/time, vehicle, and service address.
2. Customer checks travel fee before checkout.
3. Customer chooses a payment preference for future payment setup, but instant-book/no-payment mode collects `$0.00` today.
4. Customer-paid card processing remains the default future rule and is calculated only on the amount paid online today once payments are connected.
5. The $3 app cost is not shown to customers; it is tracked as a Dane-side ledger cost on each online purchase or deposit once payments are connected.
6. Booking starts as `confirmed`; Dane acknowledges it from Owner Jobs after receiving the notification.

## Cancellation And Reschedule Rules

- Customer can reschedule online until 48 hours before appointment time.
- Inside 48 hours, the app should show `Request Change` / contact-Dane copy instead of direct rescheduling.
- Customer can cancel, but deposit is refundable only until 7 days before the appointment.
- Cancelling inside 7 days marks the deposit as forfeited.
- In no-payment preview mode, canceling an unpaid booking must say no payment was collected.
- Owner can override cancel/reschedule from the owner side.
- Owner acknowledgment is separate from booking status. A booking can be confirmed before Dane acknowledges it.
- If the time unexpectedly does not work, Dane can request a reschedule and message the customer.

## Owner Scheduling Rules

- Default availability is every day.
- Dane can edit working start/end hours.
- Dane can block full days and individual time slots.
- Booking and reschedule screens hide or disable blocked/unavailable slots.
- Service duration plus buffer minutes should be considered when deciding if a slot is available.

## Owner Money And Tax Rules

- Reports should show money coming in: online card payments, deposit payments, full-card payments, cash balances due, and forfeited deposits.
- Completing a job should open an owner closeout step, not instantly close the booking.
- Owner closeout can record a make-good/owner adjustment, cash collected, remaining balance, or refund-needed note.
- If the customer already paid by card, a later discount is treated as a refund needed. Real refunding requires connected Stripe/backend permissions.
- Confirmed jobs auto-close after 7 days if Dane does not close them, but any money still due remains flagged for review.
- Reports should show ledger items: $3 app costs from Dane's cut, customer-paid card processing fees, owner adjustments, and refund-needed amounts.
- CSV export should include payment choice, service price, travel fee, discount, owner adjustment, deposit, paid online today, cash collected, cash balance due, card fee, refund needed, app fee, app fee routing status, cancellation outcome, completion date, closeout status, and job total.
- Automatic $3 routing to BrandNew/Tim is future backend + Stripe Connect work. In this frontend-only pass it is ledger-only.

## Free/Test-Mode Service Policy

- **NHTSA vPIC:** allowed now. It is an official public vehicle API and includes VIN decode endpoints.
- **Stripe:** test-mode planning only until a backend exists. Stripe has no setup or monthly fee on standard pricing, but real payments have per-transaction fees.
- **Stripe Connect:** required later for automatic BrandNew app-fee routing; do not attempt this in GitHub Pages.
- **EmailJS:** possible free email testing option. Free plan is limited to 200 monthly requests.
- **Google Calendar API:** possible later for owner calendar sync. It has quotas and standard use is available at no additional cost under current published limits.
- **OpenRouteService:** possible free routing/geocoding option with a standard free plan and published daily/minute limits.
- **Nominatim/OpenStreetMap:** possible only for light geocoding if usage policy is followed. Do not use it for heavy or bulk geocoding.
- **Supabase Free:** possible later for database/auth/storage, but frontend-only GitHub Pages must not expose privileged keys.
- **Twilio Trial:** possible testing only. Trial SMS has limitations and is not production customer messaging.

## Production Foundation Direction

- Supabase Free is the default backend candidate for the finished-product path.
- GitHub Pages remains the frontend host for the current free preview.
- Stripe must start with education and test mode/sandbox only; live Stripe is not approved.
- Real SMS to Dane should be added through a backend/provider later; the frontend preview records the owner acknowledgment state without sending SMS.
- See `docs/PRODUCTION_FOUNDATION_PLAN.md` for the backend/payment starting point.

Sources checked:

- [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/)
- [Stripe pricing](https://stripe.com/pricing)
- [Stripe Connect charges](https://docs.stripe.com/connect/charges)
- [EmailJS pricing](https://www.emailjs.com/pricing/)
- [Google Calendar API quotas](https://developers.google.com/calendar/api/guides/quota)
- [OpenRouteService plans](https://openrouteservice.org/plans/)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
- [Supabase pricing](https://supabase.com/pricing)
- [Twilio trial limitations](https://help.twilio.com/articles/360036052753-Twilio-Free-Trial-Limitations)
