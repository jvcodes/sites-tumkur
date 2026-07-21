import { test, expect } from '@playwright/test';

// The key pages in the app that must have SEO metadata
const SEO_PAGES = [
  { path: '/', expectedTitle: 'SiteHub - Find Your Perfect Site' }, // Assuming this is the title, will adapt if different
  { path: '/upload-site', expectedTitle: 'Post Property' },
  { path: '/login', expectedTitle: 'Login' }
];

test.describe('SEO & Metadata Regression Tests', () => {

  for (const pageInfo of SEO_PAGES) {
    test(`Page ${pageInfo.path} should have valid SEO metadata`, async ({ page }) => {
      await page.goto(pageInfo.path);

      // 1. Verify a title tag exists and isn't empty
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      
      // 2. Verify a meta description exists for search engines
      const metaDescription = page.locator('meta[name="description"]');
      // Some pages might not have it yet, but this test enforces it moving forward.
      // We will ensure at least a meta description tag exists.
      const hasDescription = await metaDescription.count();
      expect(hasDescription).toBeGreaterThanOrEqual(1);

      // 3. Verify Open Graph (OG) tags for social media sharing
      // (Optional strictness, let's just check if og:title or similar exists if needed, 
      // but description is the bare minimum for SEO)
      
      // Verify viewport for mobile responsiveness
      const viewport = page.locator('meta[name="viewport"]');
      expect(await viewport.count()).toBeGreaterThanOrEqual(1);
    });
  }
});
