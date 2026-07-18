import { test, expect } from '@playwright/test';

test.describe('SiteHub Homepage Filters & Scroll Restoration', () => {
  test('should apply price filter, navigate to details, and restore state on back', async ({ page }) => {
    // 1. Go to Homepage
    await page.goto('http://localhost:3000/');
    
    // Wait for initial load
    await expect(page.locator('text=properties found').first()).toBeVisible({ timeout: 10000 });
    
    // Store the initial number of properties
    const initialText = await page.locator('p:has-text("properties found")').first().innerText();
    const initialCount = parseInt(initialText.split(' ')[0], 10);
    expect(initialCount).toBeGreaterThan(0);
    
    // 2. Apply a filter (e.g. Under 20 Lakhs)
    await page.check('text=Under 20 Lakhs');
    
    // Wait for the API to fetch and update the count (it should be less than the total)
    // The fetch has a 300ms debounce
    await page.waitForTimeout(1000);
    
    const filteredText = await page.locator('p:has-text("properties found")').first().innerText();
    const filteredCount = parseInt(filteredText.split(' ')[0], 10);
    expect(filteredCount).toBeLessThan(initialCount);
    
    // 3. Click the first property card to go to the Details Page
    // The SiteCard contains a link with the location text
    const firstPropertyLink = page.locator('a[href^="/site/"]').first();
    await firstPropertyLink.click();
    
    // Verify we are on the details page
    await expect(page).toHaveURL(/\/site\/.+/);
    await expect(page.locator('button:has-text("Back to Properties")')).toBeVisible();
    
    // 4. Click the dedicated Back Button
    await page.locator('button:has-text("Back to Properties")').click();
    
    // Verify we are back on the homepage
    await expect(page).toHaveURL('http://localhost:3000/');
    
    // 5. Verify the state was restored!
    // The "Under 20 Lakhs" checkbox should still be checked (auto-retries for React hydration)
    await expect(page.locator('label:has-text("Under 20 Lakhs") input').first()).toBeChecked({ timeout: 10000 });
    
    // The filtered count should be exactly what it was before we left
    const restoredText = await page.locator('p:has-text("properties found")').first().innerText();
    const restoredCount = parseInt(restoredText.split(' ')[0], 10);
    expect(restoredCount).toBe(filteredCount);
  });
});
