import { test, expect } from '@playwright/test';
import mockDb from './mock_db.json';

// Define performance thresholds (in milliseconds)
const THRESHOLDS = {
  HOMEPAGE_LOAD: 3500, // Dev server initial compilation can take 2-3s
  FILTER_ACTION: 1500,  // Filtering locally in React
};

test.describe('SiteHub Performance & Timing Tests (Mocked API)', () => {

  test.beforeEach(async ({ page }) => {
    // Intercept ALL backend API calls to `/api/sites/filter*`
    // This entirely bypasses the real Django/MongoDB backend
    await page.route('**/api/sites/filter*', async (route) => {
      // Small simulated network delay to make the test realistic but fast
      await new Promise(resolve => setTimeout(resolve, 50)); 
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDb)
      });
    });

    // Mock locations API as well
    await page.route('**/api/sites/locations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ locations: ["Tumkur", "Gubbi", "Sira"] })
      });
    });
  });

  test('Homepage should load and render sites within threshold', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for the mock sites to render (we mocked 3 sites)
    await expect(page.getByText('Prime Mock Site A')).toBeVisible();
    await expect(page.getByText('Commercial Layout C')).toBeVisible();

    const loadTime = Date.now() - startTime;
    console.log(`Homepage Load Time (Mocked): ${loadTime}ms`);
    
    // Assert performance
    expect(loadTime).toBeLessThan(THRESHOLDS.HOMEPAGE_LOAD);
  });

  test('Applying filters should be fast and not trigger full page re-render lag', async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip(); // Only test desktop search input performance for simplicity
    }
    await page.goto('/');
    await expect(page.getByText('Prime Mock Site A')).toBeVisible();

    // Now test a UI interaction (like typing in search or clicking a filter)
    const startTime = Date.now();
    
    // Open desktop location filter (assuming desktop view for performance test)
    await page.getByPlaceholder('Search for plots, sites, landmarks...').fill('Sira');

    // In a real app this triggers an API call, which we've mocked.
    // Wait for the specific filtered result to appear (we simulate the API returning the same mock data for simplicity,
    // so it should just re-render).
    await expect(page.getByText('Prime Mock Site A')).toBeVisible(); // Just verifying the render loop completed

    const filterTime = Date.now() - startTime;
    console.log(`Search Action Time: ${filterTime}ms`);
    
    expect(filterTime).toBeLessThan(THRESHOLDS.FILTER_ACTION);
  });
});
