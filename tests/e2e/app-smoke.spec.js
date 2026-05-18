import { expect, test } from '@playwright/test';

async function resetAndEnterHome(page) {
  await page.goto('/');
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

test('app loads, home renders, and bottom navigation works', async ({ page }) => {
  await resetAndEnterHome(page);
  await expect(page.getByText('The Peoples Detailing')).toBeVisible();
  await expect(page.getByAltText('The Peoples Detailing mascot')).toBeVisible();
  await page.getByRole('button', { name: /Bookings/i }).click();
  await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
  await page.getByRole('button', { name: /Profile/i }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('home notification bell opens messages', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Open messages and notifications/i }).click();
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
});

test('browse services opens the complete price list', async ({ page }) => {
  await page.goto('/');
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

test('saved vehicle edit button updates the vehicle name', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Profile/i }).click();
  await page.getByRole('button', { name: /My Vehicles/i }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Editing saved vehicle', { exact: true })).toBeVisible();
  await page.getByPlaceholder(/White F-150/i).fill('Weekend detail rig');
  await page.getByLabel('Trim').fill('XLT');
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
          Trim: 'EX',
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

test('booking detail reschedule updates the existing booking time', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Bookings/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: 'Reschedule' }).click();
  await expect(page.getByRole('heading', { name: 'Reschedule Booking' })).toBeVisible();
  await page.getByRole('button', { name: '12:00 PM' }).click();
  await page.getByRole('button', { name: 'Save New Date & Time' }).click();
  await expect(page.getByRole('heading', { name: 'Booking' })).toBeVisible();
  await expect(page.getByText(/12:00 PM/)).toBeVisible();
});

test('service selection and booking flow reach checkout with all fee lines', async ({ page }) => {
  await reachCheckout(page);
  await expect(page.getByText('Subtotal')).toBeVisible();
  await expect(page.getByText('Travel fee')).toBeVisible();
  await expect(page.getByText('App fee')).toBeVisible();
  await expect(page.getByText('Card processing fee')).toBeVisible();
  await expect(page.getByText('Total due today')).toBeVisible();
  await expect(page.getByText(/No surprise charges/i)).toBeVisible();
});

test('typed Nashville service address estimates travel fee before checkout', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await page.getByPlaceholder(/Enter address or city/i).fill('Nashville, Tennessee');
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText(/Nashville, Tennessee/i)).toBeVisible();
  await expect(page.getByText('$37.50')).toBeVisible();
});

test('promo and saved vehicle carry into confirmed booking', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Pick a saved vehicle/i }).click();
  await page.getByPlaceholder(/White F-150/i).fill('White F-150');
  await page.getByLabel('Year').fill('2022');
  await page.getByLabel('Make').fill('Ford');
  await page.getByLabel('Model').fill('F-150');
  await page.getByLabel('Trim').fill('XLT');
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
  await page.getByRole('button', { name: /Pay with Card/i }).click();
  await expect(page.getByRole('heading', { name: /You're All Set/i })).toBeVisible();
  await expect(page.getByText(/White F-150/)).toBeVisible();
  await expect(page.getByText(/PEOPLES10/i)).toBeVisible();
});

test('owner settings can absorb card fee and tracker statuses render', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /reset demo/i }).click();
  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Settings' }).click();
  await expect(page.getByText('Covered by business')).toBeVisible();
  await page.getByRole('button', { name: /^Customer$/i }).click();
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Continue to Location & Travel Fee/i }).click();
  await page.getByRole('button', { name: /Use my current location/i }).click();
  await page.getByRole('button', { name: /Continue to Checkout/i }).click();
  await expect(page.getByText('Covered by business')).toBeVisible();

  await page.getByRole('button', { name: /^Owner$/i }).click();
  await page.locator('button.card').filter({ hasText: 'Tracker' }).click();
  await expect(page.getByRole('button', { name: /On the Way/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /I'm Here/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Completed/i })).toBeVisible();
});

test('BrandNew attribution remains in the app fee popup', async ({ page }) => {
  await reachCheckout(page);
  await page.getByRole('button', { name: /What is the app fee/i }).click();
  await expect(page.getByText(/This small app fee helps keep online booking/i)).toBeVisible();
  await expect(page.getByText('BrandNew Design link coming soon')).toBeVisible();
});
