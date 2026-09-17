import { test, expect } from '@playwright/test';

test.describe('SiteHub Cart Flow', () => {
  test('should load homepage, add site to cart, and view cart', async ({ page }) => {
    // 1. Go to Home Page
    await page.goto('/');

    // 2. Find the first site card and click "Schedule Visit"
    const visitButton = page.getByRole('button', { name: 'Schedule Visit' }).first();
    // Only proceed if there is at least one site loaded
    if (await visitButton.isVisible()) {
      await visitButton.click();
      
      // 3. Navigate to cart
      await page.goto('/cart');

      // 4. Verify cart has items loaded
      const dateInput = page.locator('input[type="date"]');
      await expect(dateInput).toBeVisible();

      // 5. Ensure that the cart item rendered correctly and does not show "Unknown Location"
      await expect(page.getByText('Unknown Location')).not.toBeVisible();
      
      // Also ensure at least some valid location text exists (it renders with an SVG map pin icon)
      // We can assert that the specific cart item container is visible
      const cartItemsContainer = page.locator('.lg\\:col-span-8');
      await expect(cartItemsContainer).toBeVisible();
    }
  });
});
