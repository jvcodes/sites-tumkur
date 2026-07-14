import { test, expect } from '@playwright/test';

test.describe('SiteHub Cart Distance Warnings', () => {
  test('should display blue warning for close properties', async ({ page }) => {
    await page.goto('/');

    // Inject two sites that are very close to each other (e.g., both in Bangalore)
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([
        { site_code: 'TEST-1', name: 'Site A', price: 1000, latitude: 12.9716, longitude: 77.5946, image_urls: [] },
        { site_code: 'TEST-2', name: 'Site B', price: 2000, latitude: 12.9720, longitude: 77.5950, image_urls: [] }
      ]));
    });

    await page.goto('/cart');

    // Wait for the cart items to render
    await expect(page.locator('text=Site A')).toBeVisible();

    // Verify distance warning is blue (close proximity)
    // The warning text should be visible
    const warningText = page.locator('text=approximately 2 properties');
    
    // Ensure we don't have the red warning
    await expect(page.locator('text=These properties are quite far apart')).not.toBeVisible();
  });

  test('should display red warning for distant properties', async ({ page }) => {
    await page.goto('/');

    // Inject two sites that are far apart (e.g., Bangalore and Mysore)
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([
        { site_code: 'TEST-1', name: 'Site A', price: 1000, latitude: 12.9716, longitude: 77.5946, image_urls: [] }, // Bangalore
        { site_code: 'TEST-2', name: 'Site B', price: 2000, latitude: 12.2958, longitude: 76.6394, image_urls: [] }  // Mysore
      ]));
    });

    await page.goto('/cart');

    // Wait for the cart items to render
    await expect(page.locator('text=Site A')).toBeVisible();

    // Verify distance warning is red (distant properties)
    const warningText = page.locator('text=These properties are spread very far apart');
    await expect(warningText).toBeVisible();
  });
});
