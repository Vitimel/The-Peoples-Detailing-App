# Test Report

See `docs/FINAL_VERIFICATION_REPORT.md` for the full verification pass.

## Standard Commands

Run these in a normal terminal with Node.js/npm available:

```bash
npm install
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Result In This Codex Environment

The global `npm` and `npx` commands were not on PATH, but the bundled Node executable worked. Dependencies came from the supplied archive, with missing Windows native optional packages downloaded from the public npm registry for local verification only.

| Check | Result |
|---|---|
| Dependency availability | Passed through archive dependencies plus Windows optional packages. |
| Unit tests | Passed: 6 fee tests. |
| Production build | Passed through Vite. |
| Dev server | Passed on `http://127.0.0.1:5173`. |
| Playwright Chromium install | Passed. |
| Playwright e2e | Passed: 10 tests across desktop and mobile Chromium. |
| Visual screenshot capture | Passed. Images saved in `docs/qa-screenshots/`. |
| Mobile overflow check | Passed at `393px` viewport width. |

## Verified Coverage

- Unit fee rules: flat `$3.00` app fee, percent/min/max fallback behavior, customer-paid card fee, absorbed card fee, checkout total.
- App smoke: load, home, service selection, booking navigation, checkout lines, promo carry-through, saved vehicle carry-through, My Vehicles, owner dashboard, owner settings, status labels, BrandNew attribution, bottom navigation, mobile smoke.

## Notes

- No paid services were used.
- Browser GPS distance estimation was added with demo fallback. No backend, Stripe, SMS, email, auth, database, calendar, map/routing, reverse geocoding, or deployment work was started.
- The screenshot set may show a temporary mock toast from the location-flow interaction. That toast is expected and dismisses in normal use.
