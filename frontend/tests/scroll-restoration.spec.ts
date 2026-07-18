import { test, expect } from '@playwright/test';

test.describe('SiteHub Scroll Restoration', () => {

  test('should restore scroll position after load more and navigating back', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    
    // 1. Go to homepage
    await page.goto('http://localhost:3000/');
    await expect(page.locator('text=properties found').first()).toBeVisible({ timeout: 15000 });

    // 2. Click "Load More" to append more items
    const loadMoreBtn = page.locator('button', { hasText: 'Load More Properties' });
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click();
      // wait for 2nd page to load
      await page.waitForTimeout(2000);
    }

    // 3. Find the last link and scroll to it
    const links = page.locator('a[href^="/site/"]');
    const linkCount = await links.count();
    
    // We just click the last link available to ensure we are clicking something far down
    await links.nth(linkCount - 1).scrollIntoViewIfNeeded();
    const scrollBeforeClick = await page.evaluate(() => window.scrollY);
    
    await links.nth(linkCount - 1).click();

    // 4. Verify we reached the detail page
    await expect(page).toHaveURL(/\/site\/.+/);
    await expect(page.locator('text=Back to Properties')).toBeVisible({ timeout: 15000 });

    // 5. Click "Back to Properties"
    await page.locator('text=Back to Properties').click();

    // 6. Verify we are back on the homepage
    await expect(page).toHaveURL('http://localhost:3000/');

    // 7. Wait for restoration logic (max 3 seconds)
    await page.waitForTimeout(3000);

    // 8. Verify the scroll position is restored!
    const finalScrollY = await page.evaluate(() => window.scrollY);
    
    // It should be within 200 pixels of what it was before clicking
    expect(Math.abs(finalScrollY - scrollBeforeClick)).toBeLessThan(200);
  });
});
