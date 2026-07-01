import { test, expect } from '@playwright/test';

test.describe('SiteHub Cart & Booking Flow', () => {
  test('should login, add site to cart, and complete checkout', async ({ page }) => {
    // 1. Go to Login Page
    await page.goto('/login');
    
    // 2. Fill login details
    await page.getByPlaceholder('e.g. Ramesh Kumar').fill('Test User');
    await page.getByPlaceholder('e.g. ramesh@gmail.com').fill('test@example.com');
    await page.getByRole('button', { name: /Continue with Google/i }).click();

    // 3. Wait for redirect to profile or homepage, let's just go to homepage
    await page.goto('/');

    // 4. Find the first site card and click "+ Visit"
    // The buttons have the text "+ Visit", let's click the first one
    const visitButton = page.getByRole('button', { name: '+ Visit' }).first();
    await expect(visitButton).toBeVisible();
    await visitButton.click();

    // The button might change to "✓ In Cart" or similar, or we can just navigate to cart
    await page.goto('/cart');

    // 5. Verify cart has items and fill out booking form
    // The profile might take a second to auto-fill the phone, let's wait or overwrite
    const dateInput = page.locator('input[type="date"]');
    const timeInput = page.locator('input[type="time"]');
    const phoneInput = page.getByPlaceholder('Enter your 10-digit mobile number');

    // Fill in future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dateString = futureDate.toISOString().split('T')[0];

    await dateInput.fill(dateString);
    await timeInput.fill('10:00');
    
    // Check if phone is already filled or locked. If editable, fill it.
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('1234567890');
    }

    // 6. Submit the booking
    await page.getByRole('button', { name: 'Submit Visit Request' }).click();

    // 7. Verify success receipt
    await expect(page.locator('text=Booking Confirmed!')).toBeVisible();
    await expect(page.locator('text=Our team will call you within 24 hours')).toBeVisible();
  });
});
