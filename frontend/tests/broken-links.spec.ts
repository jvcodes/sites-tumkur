import { test, expect } from '@playwright/test';

test.describe('Broken Links & Images Crawler', () => {

  test('Homepage should not have any broken <a> links or <img> tags', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    // Wait for network to be somewhat idle
    await page.waitForLoadState('networkidle');

    // 1. Check all images
    const images = await page.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        // Fetch the image URL to ensure it doesn't return a 404
        // Use a relative or absolute check
        const fullUrl = new URL(src, page.url()).href;
        const response = await page.request.get(fullUrl);
        expect(response.status(), `Image failed to load: ${src}`).toBeLessThan(400);
      }
    }

    // 2. Check all links
    const links = await page.locator('a').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      // Skip empty links, anchor links, or external mailto/tel
      if (href && href !== '#' && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const fullUrl = new URL(href, page.url()).href;
        
        // We only test internal links to avoid external flakiness
        if (fullUrl.startsWith(page.url())) {
            const response = await page.request.get(fullUrl);
            expect(response.status(), `Broken link found: ${href}`).toBeLessThan(400);
        }
      }
    }
  });
});
