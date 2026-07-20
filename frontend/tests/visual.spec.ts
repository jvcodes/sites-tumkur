import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  // Common paths to snapshot
  const paths = [
    { name: 'Home', path: '/' },
    { name: 'Cart', path: '/cart' },
    { name: 'Wishlist', path: '/wishlist' }
  ];

  for (const { name, path } of paths) {
    test(`Visual regression for ${name}`, async ({ page }) => {
      await page.goto(path);
      
      // Wait for network idle to ensure images/fonts are loaded
      await page.waitForLoadState('networkidle');
      
      // Take a full page screenshot and compare it with the baseline
      await expect(page).toHaveScreenshot(`${name}-full.png`, { fullPage: true });
    });
  }
});
