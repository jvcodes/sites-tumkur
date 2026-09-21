import { test, expect } from '@playwright/test';

test.describe('WhatsApp & Link Sharing and Data Isolation', () => {
  test('should open ShareModal from Homepage SiteCard and display WhatsApp and Copy Link options', async ({ page, context }) => {
    // Grant clipboard permissions on supported browsers (Chromium)
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      // WebKit / Mobile Safari does not require or support Chromium clipboard flags
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the first share button on a property card
    const firstShareBtn = page.locator('[data-testid="share-property-btn"]').first();
    await expect(firstShareBtn).toBeVisible();
    await firstShareBtn.click();

    // Verify Share Modal appears
    const modal = page.locator('div[role="dialog"][aria-label="Share Property"]');
    await expect(modal).toBeVisible();

    // Verify WhatsApp button is visible and contains expected text
    const whatsappBtn = page.locator('[data-testid="share-whatsapp-btn"]');
    await expect(whatsappBtn).toBeVisible();
    await expect(whatsappBtn).toContainText('Share on WhatsApp');

    // Verify Copy Link button is visible
    const copyLinkBtn = page.locator('[data-testid="share-copy-link-btn"]');
    await expect(copyLinkBtn).toBeVisible();
    await expect(copyLinkBtn).toContainText('Copy Property Link');

    // Click Copy Link and verify feedback
    await copyLinkBtn.click();
    await expect(copyLinkBtn).toContainText('Link Copied!');

    // Close modal with close button
    const closeBtn = page.locator('button[aria-label="Close share modal"]');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('should provide Share buttons in View Details top sticky bar, sidebar, and bottom bar', async ({ page }) => {
    // Navigate to a site details page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstCardLink = page.locator('[data-testid="view-full-details-btn"]').first();
    await firstCardLink.click();
    await page.waitForURL(/\/site\//);

    // 1. Top Sticky Bar Share Button
    const topShareBtn = page.locator('[data-testid="share-property-top-btn"]');
    await expect(topShareBtn).toBeVisible();
    await topShareBtn.click();

    let modal = page.locator('div[role="dialog"][aria-label="Share Property"]');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 2. Sidebar Price Card Share Button
    const sidebarShareBtn = page.locator('[data-testid="share-property-sidebar-btn"]');
    await expect(sidebarShareBtn).toBeVisible();
    await sidebarShareBtn.click();

    modal = page.locator('div[role="dialog"][aria-label="Share Property"]');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 3. Bottom Bar Share Button
    const bottomShareBtn = page.locator('[data-testid="share-property-bottom-btn"]');
    await expect(bottomShareBtn).toBeVisible();
    await bottomShareBtn.click();

    modal = page.locator('div[role="dialog"][aria-label="Share Property"]');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('should ensure clean UI without test badges and filter properly via backend API', async ({ page, request }) => {
    // Test API: real_only=true should filter out test properties
    const res = await request.get('http://127.0.0.1:8000/api/sites/filter/?real_only=true');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const sites = data.results || [];
    // Every returned site should NOT have is_test === true
    for (const s of sites) {
      expect(s.is_test).not.toBe(true);
    }

    // On homepage, verify clean UI with NO badges wasting card space
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Cards should NOT display any TEST badges
    const testBadges = page.locator('text=🧪 TEST');
    const badgeCount = await testBadges.count();
    expect(badgeCount).toBe(0);

    // View Details should NOT display any TEST badges
    const firstCardLink = page.locator('[data-testid="view-full-details-btn"]').first();
    await firstCardLink.click();
    await page.waitForURL(/\/site\//);

    const detailTestBadges = page.locator('text=🧪 Test Listing');
    expect(await detailTestBadges.count()).toBe(0);
  });
});
