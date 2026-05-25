# Manual Visual QA Checklist

Use this when automated Playwright cannot run or as the human approval pass before backend work.

## Setup

1. Open a terminal in `peoples-detailing-app`.
2. Run `npm install`.
3. Run `npm run test`.
4. Run `npm run build`.
5. Run `npm run dev`.
6. Open the local Vite URL, usually `http://127.0.0.1:5173`.
7. Optional e2e setup: run `npx playwright install`, then `npm run test:e2e`.

## Customer Flow

- [ ] App loads without crashing.
- [ ] Splash screen renders with The Peoples Detailing branding.
- [ ] Home screen renders with navy/orange premium style.
- [ ] Crest/logo usage looks tasteful and consistent with the approved prototype.
- [ ] Bottom navigation is visible and does not cover content.
- [ ] Service cards render Basic, Deluxe, Premium, and Monthly Maintenance.
- [ ] Service detail opens from a service card.
- [ ] `Book Deluxe Detail` or another service starts booking.
- [ ] Booking date/time screen works.
- [ ] Vehicle block shows the selected saved vehicle.
- [ ] My Vehicles screen opens.
- [ ] A vehicle can be saved with only a nickname such as `White F-150`.
- [ ] VIN/year/make/model/color/plate are available without a trim field.
- [ ] Selected saved vehicle carries back into booking.
- [ ] Location screen accepts typed address.
- [ ] `Use my current location` requests browser GPS and falls back to demo address/distance if blocked.
- [ ] Travel fee display makes sense.
- [ ] Checkout renders service price.
- [ ] Checkout renders travel fee.
- [ ] Checkout renders discount after `PEOPLES10`.
- [ ] Checkout does not render a customer app-fee line.
- [ ] Checkout renders customer-paid card processing by default.
- [ ] Checkout renders `Total due today`.
- [ ] Checkout includes no-surprise-charges language.
- [ ] Owner reports track the $3 app cost from Dane's cut.
- [ ] BrandNew attribution remains secondary in owner/reporting context.
- [ ] Pay mock checkout opens confirmation.
- [ ] Confirmation shows saved vehicle.
- [ ] Confirmation shows promo code if used.
- [ ] Booking detail shows saved vehicle and promo/discount.
- [ ] My Bookings list works.
- [ ] Profile and Messages screens do not crash.

## Owner Flow

- [ ] Owner toggle opens owner dashboard.
- [ ] Owner dashboard renders KPI cards and upcoming jobs.
- [ ] Jobs screen renders and job detail opens.
- [ ] Tracker screen renders.
- [ ] Tracker controls show only `On the Way`, `I'm Here`, and `Completed`.
- [ ] Reports screen renders.
- [ ] Services screen renders package cards.
- [ ] Settings screen renders.
- [ ] Card processing is charged only on the online payment amount.
- [ ] Returning to customer checkout after toggling reflects the selected card-processing setting.
- [ ] SMS/text provider note keeps owner SMS and controlled customer SMS scope.
- [ ] Maps/address note says browser GPS estimate only, with no maps/routing/reverse geocoding.

## Responsive Visual Check

- [ ] Desktop viewport looks like the approved centered phone-shell prototype.
- [ ] Mobile viewport does not horizontally overflow.
- [ ] Bottom nav remains usable on mobile.
- [ ] Text in buttons/cards does not visibly overlap.
- [ ] Checkout fee rows remain readable on mobile.
- [ ] Vehicle form remains usable on mobile.

## Stop Conditions

Do not move to backend, Stripe, SMS, auth, database, or calendar work until:

- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] e2e tests pass or the Playwright browser blocker is documented.
- [ ] Tim/Mac/Claude visually approve the converted app.
