# Button Audit

**Date:** 2026-05-19

Classification key:

- `works now`: action changes app state, navigates to a useful screen, downloads a local file, or otherwise works in the current prototype.
- `prototype info`: action or row is intentionally informational and clearly says the feature is not connected.
- `future integration`: visible because the feature matters later, but it must not pretend to work.
- `remove`: should not be visible unless made useful.

## Global

| Screen | Button/action | Classification | Expected behavior | Current status | Fix needed |
|---|---|---:|---|---|---|
| Demo bar | Customer | works now | Switch to customer home | Works | None |
| Demo bar | Owner | works now | Switch to owner dashboard | Works | None |
| Demo bar | Reset demo | works now | Reset localStorage demo state | Works | None |
| Bottom nav | Customer Home, Bookings, Messages, Profile | works now | Navigate to matching customer screens | Works | None |
| Bottom nav | Owner Dash, Jobs, Tracker, Reports, Settings | works now | Navigate to matching owner screens | Works | None |
| Header | Back arrow | works now | Return to prior screen for the flow | Works | Keep testing during new screens |

## Customer

| Screen | Button/action | Classification | Expected behavior | Current status | Fix needed |
|---|---|---:|---|---|---|
| Splash | Book Now | works now | Open customer home/services | Works | None |
| Splash | Browse Services | works now | Open full price list | Works | None |
| Home | Notification bell | works now | Open messages/notifications | Works | None |
| Home | Service card | works now | Open selected service detail | Works | None |
| Home | Also available service | works now | Start booking selected service | Works | None |
| Price List | Book service | works now | Start booking selected service | Works | None |
| Service Detail | Book service | works now | Start booking selected service | Works | None |
| Book Appointment | Pick a date | works now | Open calendar picker | Works | None |
| Book Appointment | Date strip day | works now | Select date unless past/full | Works | None |
| Book Appointment | Time slot | works now | Select time | Works | None |
| Book Appointment | Vehicle card | works now | Open saved vehicle manager | Works | None |
| Book Appointment | Share live location | remove | Removed because it implied real live tracking before backend/maps approval | Removed | None |
| Book Appointment | Continue to Location & Travel Fee | works now | Save appointment draft and continue | Works | None |
| Calendar Picker | Month arrows | works now | Change calendar month | Works | None |
| Calendar Picker | Cancel | works now | Close picker | Works | None |
| Calendar Picker | Use this date | works now | Save selected date | Works | None |
| Location | Check travel fee | works now | Estimate distance/fee from supported city/ZIP/address | Works | Keep no-map/no-routing language |
| Location | Use my current location | works now | Use browser GPS or demo fallback | Works | Keep browser permission/fallback copy |
| Location | Continue to Checkout | works now | Require checked fee, then continue | Works | None |
| Checkout | Apply promo | works now | Apply configured promo code or show invalid | Works | None |
| Checkout | Payment option cards | works now | Choose full card payment or $25 deposit plus cash balance | Implemented | Keep tests |
| Checkout | Hidden app cost | works now | Do not show the $3 app cost to customers; track it from Dane's cut on online purchases/deposits | Implemented | Keep tests |
| Checkout | Card fee info | works now | Toggle card-fee explanation | Works | None |
| Checkout | BrandNew link | future integration | Open real BrandNew URL when configured | Placeholder copy exists | Keep placeholder until URL is approved |
| Checkout | Pay full/deposit with card | prototype info | Confirm demo booking without real payment | Works as demo | Must remain clear Stripe is not connected |
| Confirmation | Home | works now | Return home | Works | None |
| Confirmation | My Bookings | works now | Open bookings list | Works | None |
| Confirmation | Back to Home | works now | Return home | Works | None |
| Confirmation | View Booking | works now | Open booking detail | Works | None |
| My Bookings | Upcoming/Past/Cancelled tabs | works now | Filter bookings | Works | None |
| My Bookings | Booking card | works now | Open booking detail | Works | None |
| My Bookings | Book a Service/New Service | works now | Return to home/services | Works | None |
| Booking Detail | Message icon | works now | Open messages | Fixed in audit pass | Test required |
| Booking Detail | Live location toggle | works now | Toggle local sharing state and request GPS when possible | Works locally | Keep no live-tracking implication |
| Booking Detail | Reschedule / Request Change | works now | Direct reschedule until 48 hours; inside cutoff show contact/request copy | Implemented | Keep test coverage |
| Booking Detail | Cancel | works now | Mark cancelled and record refundable/forfeited deposit outcome | Implemented | Keep test coverage |
| Profile | My Vehicles | works now | Open vehicle manager | Works | None |
| Profile | Payment Methods | prototype info | Explain Stripe setup comes later | Fixed copy | No chevron |
| Profile | Notifications | prototype info | Explain email/SMS setup comes later | Fixed copy | No chevron |
| Profile | Privacy | prototype info | Explain location privacy | Fixed copy | No chevron |
| Profile | Support | prototype info | Show call support number | Informational | No chevron |
| Vehicles | Start a new vehicle instead | works now | Clear setup form for a new vehicle from the Vehicle Setup area | Works | None |
| Vehicles | Vehicle card | works now | Select vehicle | Works | None |
| Vehicles | Edit | works now | Load vehicle into edit form | Works | None |
| Vehicles | Remove | works now | Remove vehicle unless only one remains | Works | None |
| Vehicles | Decode | works now | Call NHTSA vPIC or fallback demo match | Works | None |
| Vehicles | Save & Use/Update & Use | works now | Validate and save vehicle | Works | None |
| Messages | Message cards | prototype info | Show local demo messages | Informational | Do not show reply box until it works |

## Owner

| Screen | Button/action | Classification | Expected behavior | Current status | Fix needed |
|---|---|---:|---|---|---|
| Dashboard | Bell | works now | Open owner notifications | Fixed in audit pass | Test required |
| Dashboard | Tracker | works now | Open active job tracker | Works | None |
| Dashboard | Jobs | works now | Open jobs list | Works | None |
| Dashboard | Customers | works now | Open customer list | Fixed in audit pass | Test required |
| Dashboard | Settings | works now | Open settings | Works | None |
| Dashboard | See all | works now | Open jobs list | Works | None |
| Dashboard | Recent booking card | works now | Open job detail | Works | None |
| Owner Notifications | Notification card | works now | Open job detail | Fixed in audit pass | Test required |
| Owner Jobs | Upcoming/Completed/Cancelled tabs | works now | Filter jobs | Works | None |
| Owner Jobs | Job card | works now | Open job detail | Works | None |
| Job Detail | Open Tracker | works now | Open tracker for job | Works | None |
| Job Detail | Open Directions | works now | Open the service address in Google Maps directions without using a paid maps API | Implemented | Keep tests |
| Job Detail | Reschedule | works now | Update same booking and return to job detail | Fixed in audit pass | Test required |
| Job Detail | Cancel Job | works now | Owner override cancel; record cancellation outcome | Works | Add/keep test coverage |
| Job Detail | Close Out Job | works now | Open owner closeout before completion | Implemented | Keep tests |
| Close Out Job | Adjustment controls | works now | Record percent/dollar owner adjustment and reason | Implemented | Keep tests |
| Close Out Job | Cash collected | works now | Record cash collected for deposit/cash jobs | Implemented | Keep tests |
| Close Out Job | Refund needed | works now | Flag overpaid card jobs as refund-needed, not silently discounted | Implemented | Stripe refund later |
| Auto close | Overdue confirmed job | works now | Auto-complete after 7 days and flag payment review when needed | Implemented | Time-based testing later |
| Tracker | On the Way | works now | Save owner status to booking | Works | None |
| Tracker | I'm Here | works now | Save owner status to booking | Works | None |
| Tracker | Completed | works now | Complete job | Works | None |
| Customers | View next job | works now | Open customer next job detail | Fixed in audit pass | Test required |
| Reports | Export Tax Pack CSV | works now | Download local CSV with deposit, cash balance, card fee, owner adjustment, refund needed, app fee, and cancellation outcome | Implemented | Test required |
| Reports | Summary PDF/Bookings CSV/Trips CSV/Payouts CSV rows | future integration | Describe export contents | Informational rows only | Do not show row chevrons as clickable |
| Services | Edit | works now | Edit title, price, and duration | Fixed in audit pass | Test required |
| Services | Cancel | works now | Exit edit mode | Fixed in audit pass | Test required |
| Services | Save Service | works now | Save changes for future bookings | Fixed in audit pass | Test required |
| Settings | Reset | works now | Reset settings to defaults | Works | None |
| Settings | Preview as customer | works now | Switch to customer home | Works | None |
| Settings | Manage service menu | works now | Open service editor | Fixed in audit pass | Test required |
| Settings | Availability hours | works now | Edit working start/end hour | Implemented | Keep tests |
| Settings | Block full day | works now | Disable date for customer booking/reschedule | Implemented | Keep tests |
| Settings | Block time slot | works now | Disable selected date/time slot | Implemented | Keep tests |
| Settings | Number inputs | works now | Update local setting values | Works | None |
| Settings | App cost from Dane's cut | works now | Edit the hidden $3 app cost tracked on each online purchase/deposit | Implemented | None |
| Settings | Customer card processing toggle | works now | Keep customer-paid card processing on by default, with an owner option to cover it later | Implemented | Keep tests |
| Settings | Connection rows | prototype info | Show connection status only | Works | Do not add fake connect buttons |

## Required Follow-Up Checks

- No visible button should exist without `onClick`, an explicit disabled state, or informational styling.
- Any future integration should explain what is missing and not claim success.
- Any row that is not clickable should not show a chevron or action affordance.
- Tests should cover all high-risk actions: booking, reschedule, cancel, tracker sync, service editing, customer list, messages, and CSV export.
