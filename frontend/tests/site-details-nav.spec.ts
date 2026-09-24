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

  test('should automatically prefetch next batch and allow continuous Next navigation past initial loaded batch', async ({ page }) => {
    // 1. Mock site detail API for our test sequence
    await page.route('**/api/sites/PREFETCH-*', async (route) => {
      const url = route.request().url();
      const codeMatch = url.match(/PREFETCH-\d+/);
      const code = codeMatch ? codeMatch[0] : 'PREFETCH-1';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          site_code: code,
          name: `Prefetch Test Property ${code}`,
          location: 'Batawadi',
          price: 2500000,
          area: 1200,
          dimension: '30x40',
          facing: 'East',
          tuda_approved: true,
          images: [],
        }),
      });
    });

    // 2. Mock page 2 filter API response
    let prefetchCalled = false;
    await page.route('**/api/sites/filter?*page=2*', async (route) => {
      prefetchCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              site_code: 'PREFETCH-4',
              name: 'Prefetch Test Property PREFETCH-4',
              price: 2800000,
              location: 'Batawadi',
            },
            {
              site_code: 'PREFETCH-5',
              name: 'Prefetch Test Property PREFETCH-5',
              price: 3200000,
              location: 'Batawadi',
            },
          ],
          total: 5,
        }),
      });
    });

    // 3. Visit homepage first to initialize browser context
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 4. Inject initial homeState with 3 sites (total 5, hasMore: true)
    await page.evaluate(() => {
      const initialFeed = {
        sites: [
          { site_code: 'PREFETCH-1', name: 'Prefetch Test Property PREFETCH-1', price: 2500000, location: 'Batawadi' },
          { site_code: 'PREFETCH-2', name: 'Prefetch Test Property PREFETCH-2', price: 2600000, location: 'Batawadi' },
          { site_code: 'PREFETCH-3', name: 'Prefetch Test Property PREFETCH-3', price: 2700000, location: 'Batawadi' },
        ],
        total: 5,
        page: 1,
        hasMore: true,
        selectedLocations: ['Batawadi'],
        selectedPrices: [],
        selectedAreas: [],
        selectedFacings: [],
        sortOption: '',
        appliedSearch: '',
        inputValue: '',
        isLayoutFilter: false,
      };
      sessionStorage.setItem('homeState', JSON.stringify(initialFeed));
      sessionStorage.setItem('homeScrollPos', '200');
    });

    // 5. Navigate to the last site of initial batch (PREFETCH-3)
    await page.goto('http://localhost:3000/site/PREFETCH-3');
    await page.waitForLoadState('networkidle');

    // 6. Verify prefetch is automatically triggered because idx (2) >= length (3) - 3 (0)
    await expect.poll(() => prefetchCalled, { timeout: 10000 }).toBe(true);

    // 7. Verify Next button is active and links to PREFETCH-4 (the prefetched property)
    const nextBtnTop = page.locator('a[data-testid="next-property-top"]');
    await expect(nextBtnTop).toBeVisible({ timeout: 5000 });
    await expect(nextBtnTop).toHaveAttribute('href', '/site/PREFETCH-4');

    // 8. Click Next -> arrives at PREFETCH-4
    await nextBtnTop.click();
    await expect(page).toHaveURL(/.*\/site\/PREFETCH-4/);
    await page.waitForLoadState('networkidle');

    // 9. Click Next again -> arrives at PREFETCH-5 (the final property)
    const nextBtnTop4 = page.locator('a[data-testid="next-property-top"]');
    await expect(nextBtnTop4).toHaveAttribute('href', '/site/PREFETCH-5');
    await nextBtnTop4.click();
    await expect(page).toHaveURL(/.*\/site\/PREFETCH-5/);
    await page.waitForLoadState('networkidle');

    // 10. On PREFETCH-5 (last property of total 5), Next button link should no longer exist
    await expect(page.locator('a[data-testid="next-property-top"]')).toHaveCount(0);
    const disabledNextSpan = page.locator('span[class*="cursor-not-allowed"]:has-text("Next")').first();
    await expect(disabledNextSpan).toBeVisible();

    // 11. Click Back to Properties and verify homeState was updated with all 5 properties
    const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
    await topBackBtn.click();
    await expect(page).toHaveURL('http://localhost:3000/');

    const finalHomeState = await page.evaluate(() => {
      const raw = sessionStorage.getItem('homeState');
      return raw ? JSON.parse(raw) : null;
    });
    expect(finalHomeState).not.toBeNull();
    expect(finalHomeState.sites.length).toBe(5);
    expect(finalHomeState.sites.map((s: any) => s.site_code)).toContain('PREFETCH-4');
    expect(finalHomeState.sites.map((s: any) => s.site_code)).toContain('PREFETCH-5');
  });

  test('should render landmarks and distances fully visible without truncation', async ({ page }) => {
    await page.route('**/api/sites/LANDMARK-TEST', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          site_code: 'LANDMARK-TEST',
          name: 'Scenic Villa Plot with Long Landmark Names',
          location: 'Kyatsandra, Tumkur',
          price: 3500000,
          area: 1500,
          landmark: 'Siddaganga Mutt Main Arch',
          distance_to_main_road: '300m',
          nearby_landmarks: [
            { landmark: 'Siddaganga Institute of Technology (SIT Campus)', distance_km: 1.8 },
            { landmark: 'Tumkur District Government Multi-Speciality Hospital', distance_km: 4.2 }
          ]
        }),
      });
    });

    await page.goto('http://localhost:3000/site/LANDMARK-TEST');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify Nearby Landmarks section is visible
    const section = page.locator('[data-testid="nearby-landmarks-section"]');
    await expect(section).toBeVisible();

    // 2. Verify all landmarks are present
    const items = section.locator('[data-testid="landmark-item"]');
    await expect(items).toHaveCount(3); // 2 from array + 1 primary landmark

    // 3. Verify long landmark names and distances are rendered in full
    const sitItem = items.filter({ hasText: 'Siddaganga Institute of Technology (SIT Campus)' });
    await expect(sitItem).toBeVisible();
    await expect(sitItem.locator('text=1.8 km')).toBeVisible();

    const hospItem = items.filter({ hasText: 'Tumkur District Government Multi-Speciality Hospital' });
    await expect(hospItem).toBeVisible();
    await expect(hospItem.locator('text=4.2 km')).toBeVisible();

    // 4. Verify distance to main road in specifications
    await expect(page.locator('text=Distance to Main Road')).toBeVisible();
    await expect(page.locator('p', { hasText: '300m' })).toBeVisible();
  });
});


