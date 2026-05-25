import { expect, test } from '@playwright/test';

async function resetAndEnterHome(page) {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /book now/i }).click();
  await expect(page.getByText('Our Services')).toBeVisible();
}

async function reachCheckout(page) {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await page.getByRole('button', { name: /Use my current location/i }).click();
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
}

test('public route hides demo role controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Owner$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Developer$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reset demo/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /book now/i })).toBeVisible();
});

test('owner route opens owner tools without public demo controls', async ({ page }) => {
  await page.goto('/owner');
  await expect(page.getByText('Welcome back')).toBeVisible();
  await expect(page.locator('button.card').filter({ hasText: 'Jobs' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Developer$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reset demo/i })).toHaveCount(0);
});

test('developer route opens developer admin without public demo controls', async ({ page }) => {
  await page.goto('/developer');
  await expect(page.getByRole('heading', { name: 'Developer Admin' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit customer service prices/i })).toBeVisible();
  await expect(page.getByText(/temporary developer route/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Owner$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reset demo/i })).toHaveCount(0);
});

test('demo flag keeps the role switcher for local testing', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('button', { name: /^Customer$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Owner$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Developer$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /reset demo/i })).toBeVisible();
});

test('app loads, home renders, and bottom navigation works', async ({ page }) => {
  await resetAndEnterHome(page);
  await expect(page.getByText('The Peoples Detailing')).toBeVisible();
  await expect(page.getByAltText('The Peoples Detailing mascot')).toBeVisible();
  await page.getByRole('button', { name: /Bookings/i }).click();
  await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
  await page.getByRole('button', { name: /Profile/i }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText(/Stripe setup comes later/i)).toBeVisible();
});

test('home notification bell opens messages', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Open messages and notifications/i }).click();
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
});

test('browse services opens the complete price list', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /Browse Services/i }).click();
  await expect(page.getByRole('heading', { name: 'Price List' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Basic Detail' })).toBeVisible();
  await expect(page.getByText('$150.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Deluxe Detail' })).toBeVisible();
  await expect(page.getByText('$220.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Premium Detail' })).toBeVisible();
  await expect(page.getByText('$320.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Monthly Maintenance' })).toBeVisible();
  await expect(page.getByText('$100.00')).toBeVisible();
});

test('default end time lets short 4 PM jobs fit', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Monthly Maintenance/i }).click();
  await page.getByRole('button', { name: /Book Monthly Maintenance/i }).click();
  await expect(page.getByRole('button', { name: '4:00 PM', exact: true })).toBeEnabled();
});

test('basic detail can use 4 PM but deluxe still needs earlier time', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Basic Detail/i }).click();
  await page.getByRole('button', { name: /Book Basic Detail/i }).click();
  await expect(page.getByRole('button', { name: '4:00 PM', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Go back' }).click();
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await expect(page.getByRole('button', { name: /4:00 PM.*Needs more time/i })).toBeVisible();
});

test('date strip keeps the previous date visible after selecting the next day', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Basic Detail/i }).click();
  await page.getByRole('button', { name: /Book Basic Detail/i }).click();
  const firstDateId = await page.locator('button[data-testid^="date-strip-day-"]').first().getAttribute('data-testid');
  const secondDate = page.locator('button[data-testid^="date-strip-day-"]').nth(1);
  await secondDate.click();
  await expect(page.getByTestId(firstDateId)).toBeVisible();
  await expect(page.getByRole('button', { name: /Show previous dates/i })).toBeVisible();
});

test('owner availability defaults to a 7:30 PM end time', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Settings' }).click();
  await expect(page.getByLabel('End time')).toHaveValue('19.5');
});

test('saved vehicle edit button updates the vehicle name', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Profile/i }).click();
  await page.getByRole('button', { name: /My Vehicles/i }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Editing saved vehicle', { exact: true })).toBeVisible();
  await page.getByPlaceholder(/White F-150/i).fill('Weekend detail rig');
  await page.getByLabel('Color').fill('White');
  await page.getByRole('button', { name: /Update & Use Vehicle/i }).click();
  await expect(page.locator('.card').filter({ hasText: 'Selected vehicle' })).toContainText('Weekend detail rig');
});

test('VIN lookup fills saved vehicle details from NHTSA response', async ({ page }) => {
  await page.route('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        Results: [{
          ModelYear: '2003',
          Make: 'HONDA',
          Model: 'Accord',
          BodyClass: 'Coupe',
          DriveType: 'FWD',
          FuelTypePrimary: 'Gasoline',
        }],
      }),
    });
  });
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Profile/i }).click();
  await page.getByRole('button', { name: /My Vehicles/i }).click();
  await expect(page.getByLabel('Year')).toBeVisible();
  await page.getByPlaceholder('Optional 17-character VIN').fill('1HGCM82633A004352');
  await page.getByRole('button', { name: 'Decode' }).click();
  await expect(page.getByText(/VIN decoded with the free NHTSA vPIC database/i)).toBeVisible();
  await expect(page.getByLabel('Year')).toHaveValue('2003');
  await expect(page.getByLabel('Make')).toHaveValue('HONDA');
  await expect(page.getByLabel('Model')).toHaveValue('Accord');
});

test('customer booking detail requires request change inside reschedule cutoff', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Settings' }).click();
  await page.getByLabel('Customer reschedule cutoff').fill('240');
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Bookings/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await expect(page.getByText('Service-Day Location')).toHaveCount(0);
  await expect(page.getByText(/Exact GPS updates/i)).toHaveCount(0);
  await expect(page.getByText('Arrival Tracker')).toBeVisible();
  await expect(page.getByText('status', { exact: true })).toBeVisible();
  await expect(page.getByText(/Status updates from the owner side/i)).toHaveCount(0);
  await expect(page.getByText(/No ETA is shown until Dane adds one manually/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Request Change' }).click();
  await expect(page.getByText(/Inside 240 hours/i)).toBeVisible();
});

test('booking detail message icon opens messages', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Bookings/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Open booking messages/i }).click();
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
});

test('service selection and booking flow reaches checkout with deposit rules', async ({ page }) => {
  await reachCheckout(page);
  await expect(page.getByText('Subtotal')).toBeVisible();
  await expect(page.getByText('Travel fee')).toBeVisible();
  await expect(page.getByText('Payment Preference')).toBeVisible();
  await expect(page.getByText('Prefer full card payment')).toBeVisible();
  await expect(page.getByText('Prefer $25 deposit, cash later')).toBeVisible();
  await expect(page.getByText('App fee')).toHaveCount(0);
  await expect(page.getByText('Card processing fee')).toBeVisible();
  await expect(page.getByText('Covered by business')).toHaveCount(0);
  await expect(page.getByText('Estimated online payment')).toBeVisible();
  await expect(page.getByText('Collected now')).toBeVisible();
  await expect(page.getByText(/No card is charged in this version/i)).toBeVisible();
});

test('typed Nashville service address estimates travel fee before checkout', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await expect(page.getByText(/Check the address before checkout/i)).toBeVisible();
  await expect(page.locator('.map-bg')).toHaveCount(0);
  await page.getByPlaceholder(/Enter address, city, or ZIP/i).fill('Nashville, Tennessee');
  await page.getByRole('button', { name: /Check travel fee/i }).click();
  await expect(page.getByText('$37.50')).toBeVisible();
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText(/Nashville, Tennessee/i)).toBeVisible();
  await expect(page.getByText('$37.50')).toBeVisible();
});

test('typed exact Franklin address estimates travel fee before checkout', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await page.getByPlaceholder(/Enter address, city, or ZIP/i).fill('405 Main St, Franklin, TN 37064');
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByText(/Check the travel fee before continuing to checkout/i)).toBeVisible();
  await page.getByRole('button', { name: /Check travel fee/i }).click();
  await expect(page.getByText('$42.00')).toBeVisible();
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText(/405 Main St, Franklin, TN 37064/i)).toBeVisible();
  await expect(page.getByText('$42.00')).toBeVisible();
});

test('promo and saved vehicle carry into instant booking', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Pick a saved vehicle/i }).click();
  await page.getByPlaceholder(/White F-150/i).fill('White F-150');
  await page.getByLabel('Year').fill('2022');
  await page.getByLabel('Make').fill('Ford');
  await page.getByLabel('Model').fill('F-150');
  await page.getByLabel('Color').fill('White');
  await page.getByRole('button', { name: /Save & Use Vehicle/i }).click();
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page.getByText(/White F-150/)).toBeVisible();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await page.getByRole('button', { name: /Use my current location/i }).click();
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await page.getByPlaceholder('Try PEOPLES10').fill('PEOPLES10');
  await page.getByRole('button', { name: /^Apply$/i }).click();
  await expect(page.getByText(/PEOPLES10 applied/i)).toBeVisible();
  await page.getByRole('button', { name: /Book This Spot/i }).click();
  await expect(page.getByRole('heading', { name: /You're Booked/i })).toBeVisible();
  await expect(page.getByText(/White F-150/)).toBeVisible();
  await expect(page.getByText(/PEOPLES10/i)).toBeVisible();
});

test('deposit cash balance option records balance due', async ({ page }) => {
  await reachCheckout(page);
  await page.getByText('Prefer $25 deposit, cash later').click();
  await expect(page.getByText('Cash balance due at service')).toBeVisible();
  await page.getByRole('button', { name: /Book This Spot/i }).click();
  await expect(page.getByRole('heading', { name: /You're Booked/i })).toBeVisible();
  await page.getByRole('button', { name: /View Booking/i }).click();
  await expect(page.getByText('Deposit + cash balance')).toBeVisible();
  await expect(page.getByText('deposit due')).toBeVisible();
  await expect(page.getByText('Cash balance due')).toBeVisible();
});

test('owner can acknowledge an instant booking', async ({ page }) => {
  await reachCheckout(page);
  await page.getByRole('button', { name: /Book This Spot/i }).click();
  await expect(page.getByRole('heading', { name: /You're Booked/i })).toBeVisible();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Jobs' }).click();
  await expect(page.getByRole('button', { name: 'Needs Ack', exact: true })).toBeVisible();
  await page.locator('button.card').filter({ hasText: 'Deluxe Detail' }).first().click();
  await expect(page.getByText('New booking needs acknowledgment')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Message Customer' }).first()).toHaveAttribute('href', /sms:/);
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText('Acknowledged by Dane')).toBeVisible();
});

test('owner can request reschedule on an instant booking without deposit-forfeit language', async ({ page }) => {
  await reachCheckout(page);
  await page.getByRole('button', { name: /Book This Spot/i }).click();
  await expect(page.getByRole('heading', { name: /You're Booked/i })).toBeVisible();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Jobs' }).click();
  await page.locator('button.card').filter({ hasText: 'Deluxe Detail' }).first().click();
  await page.getByRole('button', { name: 'Request Reschedule' }).click();
  await expect(page.getByText('Reschedule requested')).toBeVisible();
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Bookings/i }).click();
  await page.locator('button.card').filter({ hasText: 'Deluxe Detail' }).filter({ hasText: '$223.60' }).click();
  await expect(page.getByText('Dane asked to reschedule')).toBeVisible();
  await expect(page.getByText(/Deposit forfeited/i)).toHaveCount(0);
});

test('developer settings show app cost while owner tracker statuses render', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Developer$/i }).click();
  await expect(page.getByRole('heading', { name: 'Developer Admin' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit customer service prices/i })).toBeVisible();
  await expect(page.getByLabel('Booking submit mode')).toBeVisible();
  await expect(page.getByLabel('Deposit amount')).toBeVisible();
  await expect(page.getByText("App cost from Dane's cut")).toBeVisible();
  await expect(page.getByText('Customer pays card processing')).toBeVisible();
  await expect(page.getByText('Connections')).toBeVisible();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Home Page')).toBeVisible();
  await expect(page.getByText('Availability')).toBeVisible();
  await expect(page.getByLabel('Block date')).toBeVisible();
  await expect(page.getByText('Business', { exact: true })).toBeVisible();
  await expect(page.getByText('Cancellations & Reschedules')).toBeVisible();
  await expect(page.getByLabel('Deposit forfeits inside')).toBeVisible();
  await expect(page.getByLabel('Customer reschedule cutoff')).toBeVisible();
  await expect(page.getByLabel('Booking submit mode')).toHaveCount(0);
  await expect(page.getByLabel('Deposit amount')).toHaveCount(0);
  await expect(page.getByText('Connections')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Edit customer service prices/i })).toHaveCount(0);
  await expect(page.getByText("App cost from Dane's cut")).toHaveCount(0);
  await expect(page.getByText('Customer pays card processing')).toHaveCount(0);
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await page.getByRole('button', { name: /Use my current location/i }).click();
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByText('Card processing fee')).toBeVisible();
  await expect(page.getByText('Covered by business')).toHaveCount(0);

  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Tracker' }).click();
  await expect(page.getByRole('button', { name: /On the Way/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /I'm Here/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Completed/i })).toBeVisible();
  await page.getByRole('button', { name: /On the Way/i }).click();
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Bookings/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await expect(page.getByText('Dane is on the way.')).toBeVisible();

  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Tracker' }).click();
  await page.getByRole('button', { name: /I'm Here/i }).click();
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Bookings/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await expect(page.getByText('Dane has arrived.')).toBeVisible();
});

test('BrandNew app cost context stays on owner reports, not customer checkout', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.getByRole('button', { name: /Reports/i }).click();
  await expect(page.getByText(/hidden from customer checkout/i)).toBeVisible();
  await expect(page.getByText(/Automatic routing to BrandNew/i)).toBeVisible();
});

test('owner dashboard actions open notifications and customers', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.getByRole('button', { name: /Open owner notifications/i }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.locator('button.card').filter({ hasText: 'Customers' }).click();
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await expect(page.locator('.card').filter({ hasText: /jobs/i }).first()).toBeVisible();
});

test('owner can reschedule a job from job detail', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Jobs' }).click();
  await page.getByRole('button', { name: 'Upcoming' }).click();
  await page.locator('button.card').filter({ hasText: 'Deluxe Detail' }).click();
  await expect(page.getByRole('link', { name: 'Open Directions' })).toHaveAttribute('href', /google\.com\/maps\/dir/);
  await page.getByRole('button', { name: 'Reschedule' }).click();
  await expect(page.getByRole('heading', { name: 'Reschedule Booking' })).toBeVisible();
  await page.getByRole('button', { name: '8:00 AM', exact: true }).click();
  await page.getByRole('button', { name: 'Save New Date & Time' }).click();
  await expect(page.getByRole('heading', { name: 'Job Detail' })).toBeVisible();
  await expect(page.getByText(/8:00 AM/)).toBeVisible();
});

test('owner closeout can record an adjustment and refund needed', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Jobs' }).click();
  await page.getByRole('button', { name: 'Upcoming' }).click();
  await page.locator('button.card').filter({ hasText: 'Deluxe Detail' }).click();
  await page.getByRole('button', { name: /Close Out Job/i }).click();
  await expect(page.getByRole('heading', { name: 'Close Out Job' })).toBeVisible();
  await page.getByLabel('Adjustment value').fill('10');
  await page.getByLabel('Adjustment reason').fill('Make-good discount');
  await expect(page.getByText(/Refund needed: \$/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close Job' }).click();
  await expect(page.getByRole('heading', { name: 'Job Detail' })).toBeVisible();
  await expect(page.getByText(/refund needed/i).last()).toBeVisible();
});

test('developer can edit service menu pricing', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Developer$/i }).click();
  await page.getByRole('button', { name: /Edit customer service prices/i }).click();
  await expect(page.getByRole('heading', { name: 'Service Prices' })).toBeVisible();
  await page.locator('.card').filter({ hasText: 'Basic Detail' }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Service price').fill('175');
  await page.getByRole('button', { name: /Save Service/i }).click();
  await expect(page.locator('.card').filter({ hasText: 'Basic Detail' })).toContainText('$175.00');
});

test('owner tax pack export downloads CSV', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.getByRole('button', { name: /Reports/i }).click();
  await expect(page.getByRole('heading', { name: 'Tax Pack' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Tax Pack CSV/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('peoples-detailing-tax-pack');
});

test('owner can block a time slot from customer booking', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Settings' }).click();
  const blockDate = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.getByLabel('Block date').fill(blockDate);
  await page.getByLabel('Block time slot').selectOption({ label: '8:00 AM' });
  await page.getByRole('button', { name: /Block time slot/i }).click();
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await expect(page.getByRole('button', { name: /8:00 AM.*Blocked time/i })).toBeVisible();
});

test('minimum booking notice automatically blocks near-term customer slots', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Settings' }).click();
  await page.getByLabel('Minimum booking notice').fill('96');
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await expect(page.getByRole('button', { name: /10:00 AM.*Too soon/i })).toBeVisible();
});
