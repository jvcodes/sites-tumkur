import { test, expect } from '@playwright/test';

test.describe('Site Details Navigation & Sticky Controls', () => {
  test('should allow clicking Back to Properties even after scrolling halfway down', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 2. Click "View full details" on the first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();

    // Verify we arrived on a site detail page
    await expect(page).toHaveURL(/.*\/site\/.+/);
    const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
    await expect(topBackBtn).toBeVisible();

    // 3. Scroll down halfway (e.g. 600px)
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);

    // 4. Verify sticky top back button remains visible and clickable
    await expect(topBackBtn).toBeVisible();
    await topBackBtn.click();

    // 5. Verify it smoothly navigates back to homepage
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should allow clicking Back to Properties from bottom navigation card', async ({ page }) => {
    // 1. Open first property
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();

    await expect(page).toHaveURL(/.*\/site\/.+/);

    // 2. Scroll all the way to the bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    // 3. Verify bottom "Back to All Properties" button is visible and clickable
    const bottomBackBtn = page.locator('[data-testid="back-to-properties-bottom"]');
    await expect(bottomBackBtn).toBeVisible();
    await bottomBackBtn.click();

    // 4. Verify it returns to homepage
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should navigate smoothly to Next Property and Previous Property directly from view details', async ({ page }) => {
    // 1. Start from homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Click on the first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/);

    const initialUrl = page.url();
    expect(initialUrl).toContain('/site/');

    // 2. Click "Next Property" from the top navigation
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    if (await nextBtnTop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtnTop.click();
      await page.waitForLoadState('networkidle');

      const nextUrl = page.url();
      expect(nextUrl).toContain('/site/');
      expect(nextUrl).not.toEqual(initialUrl);

      // 3. Click "Prev Property" from top navigation to return to the first property
      const prevBtnTop = page.locator('[data-testid="prev-property-top"]');
      await expect(prevBtnTop).toBeVisible();
      await prevBtnTop.click();
      await page.waitForURL(initialUrl);
      expect(page.url()).toEqual(initialUrl);
    }

    // 4. Test bottom navigation cards for Next Property
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const nextBtnBottom = page.locator('[data-testid="next-property-bottom"]');
    if (await nextBtnBottom.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtnBottom.click();
      await expect(page).not.toHaveURL(initialUrl);
    }
  });

  test('should return straight to all properties homepage after multiple consecutive moves (top back button)', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 2. Open first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/);

    // 3. Perform multiple sequential moves (Next Property twice)
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    if (await nextBtnTop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtnTop.click();
      await page.waitForLoadState('networkidle');
      const secondSiteUrl = page.url();

      if (await nextBtnTop.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtnTop.click();
        await page.waitForLoadState('networkidle');
        const thirdSiteUrl = page.url();
        expect(thirdSiteUrl).not.toEqual(secondSiteUrl);
      }

      // 4. Click "Back to Properties" from top navigation
      const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
      await topBackBtn.click();

      // 5. CRITICAL CHECK: Must return straight to homepage (NOT previous view details!)
      await expect(page).toHaveURL('http://localhost:3000/');
    }
  });

  test('should return straight to all properties homepage after multiple consecutive moves (bottom back button)', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 2. Open first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/);

    // 3. Perform multiple sequential moves
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    if (await nextBtnTop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtnTop.click();
      await page.waitForLoadState('networkidle');

      if (await nextBtnTop.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtnTop.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // 4. Scroll to bottom and click "Back to All Properties"
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    const bottomBackBtn = page.locator('[data-testid="back-to-properties-bottom"]');
    await expect(bottomBackBtn).toBeVisible({ timeout: 5000 });
    await bottomBackBtn.click();

    // 5. CRITICAL CHECK: Must return straight to homepage
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should display prominently highlighted arrow badges on navigation controls', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/);

    // Verify top bar highlighted arrows
    await expect(page.locator('[data-testid="back-top-arrow-highlight"]')).toBeVisible();
    const nextArrow = page.locator('[data-testid="next-arrow-highlight"]');
    if (await nextArrow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(nextArrow).toBeVisible();
    }

    // Scroll to bottom and verify bottom highlighted arrows
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    await expect(page.locator('[data-testid="back-bottom-arrow-highlight"]')).toBeVisible();
    const nextBottomArrow = page.locator('[data-testid="next-bottom-arrow-highlight"]');
    if (await nextBottomArrow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(nextBottomArrow).toBeVisible();
    }
  });

  test('should restore previous homepage scroll position when navigating back from view details', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Wait for sites and homeState to be populated
    await page.waitForFunction(() => !!sessionStorage.getItem('homeState'));

    // 2. Scroll down to a property card further down the list
    const detailLinks = page.locator('a:has-text("View full details")');
    await expect(detailLinks.first()).toBeVisible({ timeout: 15000 });

    const cardCount = await detailLinks.count();
    // Choose second or third card to ensure meaningful scroll
    const targetIdx = Math.min(2, cardCount - 1);
    const targetCard = detailLinks.nth(targetIdx);

    await targetCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const scrollBeforeClick = await page.evaluate(() => window.scrollY);
    expect(scrollBeforeClick).toBeGreaterThan(50);

    // 3. Click into details (records homeScrollPos in sessionStorage)
    await targetCard.click();
    await expect(page).toHaveURL(/.*\/site\/.+/);
    await page.waitForLoadState('networkidle');

    // 4. Click Back to Properties
    const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
    await expect(topBackBtn).toBeVisible();
    await topBackBtn.click();

    // 5. Verify URL returns to homepage
    await expect(page).toHaveURL('http://localhost:3000/');

    // 6. Verify scroll position is restored within tolerance
    await page.waitForFunction(
      (expected) => Math.abs(window.scrollY - expected) < 150,
      scrollBeforeClick,
      { timeout: 8000 }
    );

    const scrollAfterReturn = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfterReturn - scrollBeforeClick)).toBeLessThan(150);
  });

  test('should display TUDA Approved checklist item in site details page', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 2. Click on the first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();

    await expect(page).toHaveURL(/.*\/site\/.+/);
    await page.waitForLoadState('networkidle');

    // 3. Check TUDA Approved status element and row
    const tudaItem = page.locator('[data-testid="tuda-approved-item"]');
    await expect(tudaItem).toBeVisible();
    expect(await tudaItem.textContent()).toContain('TUDA Approved:');

    const tudaStatus = page.locator('[data-testid="tuda-approved-status"]');
    await expect(tudaStatus).toBeVisible();
    const statusText = await tudaStatus.textContent();
    expect(statusText).toMatch(/✅ Yes|❌ No/);
  });

  test('should allow selecting TUDA Approved and adding Tumkur landmarks with distances in upload form', async ({ page }) => {
    // 1. Mock user authentication
    await page.goto('http://localhost:3000/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Tumkur Agent', email: 'agent@tumkur.com' }));
    });

    // 2. Navigate to upload-site
    await page.goto('http://localhost:3000/upload-site');
    await page.waitForLoadState('networkidle');

    // 3. Verify TUDA Approved checkbox
    const tudaCheckbox = page.locator('[data-testid="tuda-approved-checkbox"]');
    await expect(tudaCheckbox).toBeVisible();
    await expect(tudaCheckbox).not.toBeChecked();
    await tudaCheckbox.check();
    await expect(tudaCheckbox).toBeChecked();

    // 4. Verify Tumkur Landmarks selector
    const landmarkSelect = page.locator('[data-testid="landmark-select"]');
    await expect(landmarkSelect).toBeVisible();

    // Select a Tumkur landmark
    await landmarkSelect.selectOption({ label: 'Tumkur Railway Station' });

    // Enter distance
    const distanceInput = page.locator('[data-testid="landmark-distance-input"]');
    await distanceInput.fill('2.5');

    // Click Add
    const addBtn = page.locator('[data-testid="add-landmark-btn"]');
    await addBtn.click();

    // Verify added to the landmarks list
    const landmarksList = page.locator('[data-testid="selected-landmarks-list"]');
    await expect(landmarksList).toBeVisible();
    await expect(landmarksList).toContainText('Tumkur Railway Station');
    await expect(landmarksList).toContainText('2.5 km');
  });
});
