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
  await page.getByRole('button', { name: /Bookings/i }).click();
  await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
  await page.getByRole('button', { name: /Profile/i }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
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

test('promo and saved vehicle carry into confirmed booking', async ({ page }) => {
  await resetAndEnterHome(page);
  await page.getByRole('button', { name: /Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Book Deluxe Detail/i }).click();
  await page.getByRole('button', { name: /Pick a saved vehicle/i }).click();
  await page.getByPlaceholder(/White F-150/i).fill('White F-150');
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
