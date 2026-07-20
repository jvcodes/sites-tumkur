import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  const paths = [
    { name: 'Home', path: '/' },
    { name: 'Cart', path: '/cart' },
    { name: 'Wishlist', path: '/wishlist' }
  ];

  for (const { name, path } of paths) {
    test(`Accessibility analysis for ${name}`, async ({ page }) => {
      await page.goto(path);
      
      // Wait for content to load
      await page.waitForLoadState('networkidle');

      try {
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        
        // Assert that there are no accessibility violations
        expect(accessibilityScanResults.violations).toEqual([]);
      } catch (e) {
        console.error(`Accessibility errors on ${name}:`, e);
        throw e;
      }
    });
  }
});
