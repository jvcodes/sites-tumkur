import { test, expect } from '@playwright/test';

test.describe('Site Details Navigation & Sticky Controls', () => {
  test('should allow clicking Back to Properties even after scrolling halfway down', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click "View full details" on the first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();

    // Verify we arrived on a site detail page
    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
    await expect(topBackBtn).toBeVisible({ timeout: 15000 });
    await expect(topBackBtn).toContainText('Home');

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
    await page.waitForLoadState('domcontentloaded');
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();

    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });

    // 2. Scroll all the way to the bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    // 3. Verify bottom "Home" button is visible and clickable
    const bottomBackBtn = page.locator('[data-testid="back-to-properties-bottom"]');
    await expect(bottomBackBtn).toBeVisible({ timeout: 15000 });
    await expect(bottomBackBtn).toContainText('Home');
    await bottomBackBtn.click();

    // 4. Verify it returns to homepage
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should navigate smoothly to Next Property and Previous Property directly from view details', async ({ page }) => {
    // 1. Start from homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    // Click on the first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });

    const initialUrl = page.url();
    expect(initialUrl).toContain('/site/');

    // 2. Click "Next Property" from the top navigation
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    if (await nextBtnTop.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtnTop.click();
      await expect(page).not.toHaveURL(initialUrl, { timeout: 15000 });
      await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });

      const nextUrl = page.url();
      expect(nextUrl).toContain('/site/');
      expect(nextUrl).not.toEqual(initialUrl);

      // 3. Click "Prev Property" from top navigation to return to the first property
      const prevBtnTop = page.locator('[data-testid="prev-property-top"]');
      await expect(prevBtnTop).toBeVisible({ timeout: 15000 });
      await prevBtnTop.click();
      await expect(page).toHaveURL(initialUrl, { timeout: 15000 });
      await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
      expect(page.url()).toEqual(initialUrl);
    }

    // 4. Test bottom navigation cards for Next Property
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const nextBtnBottom = page.locator('[data-testid="next-property-bottom"]');
    if (await nextBtnBottom.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtnBottom.click();
      await expect(page).not.toHaveURL(initialUrl, { timeout: 15000 });
    }
  });

  test('should return straight to all properties homepage after multiple consecutive moves (top back button)', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    // 2. Open first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
    const initialUrl = page.url();

    // 3. Perform multiple sequential moves (Next Property twice)
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    if (await nextBtnTop.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtnTop.click();
      await expect(page).not.toHaveURL(initialUrl, { timeout: 15000 });
      await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
      const secondSiteUrl = page.url();

      if (await nextBtnTop.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nextBtnTop.click();
        await expect(page).not.toHaveURL(secondSiteUrl, { timeout: 15000 });
        await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
        const thirdSiteUrl = page.url();
        expect(thirdSiteUrl).not.toEqual(secondSiteUrl);
      }

      // 4. Click "Back to Properties" from top navigation
      const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
      await expect(topBackBtn).toBeVisible({ timeout: 15000 });
      await topBackBtn.click();

      // 5. CRITICAL CHECK: Must return straight to homepage (NOT previous view details!)
      await expect(page).toHaveURL('http://localhost:3000/');
    }
  });

  test('should return straight to all properties homepage after multiple consecutive moves (bottom back button)', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    // 2. Open first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
    const initialUrl = page.url();

    // 3. Perform multiple sequential moves
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    if (await nextBtnTop.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtnTop.click();
      await expect(page).not.toHaveURL(initialUrl, { timeout: 15000 });
      await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
      const secondSiteUrl = page.url();

      if (await nextBtnTop.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nextBtnTop.click();
        await expect(page).not.toHaveURL(secondSiteUrl, { timeout: 15000 });
        await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
      }
    }

    // 4. Scroll to bottom and click "Back to All Properties"
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    const bottomBackBtn = page.locator('[data-testid="back-to-properties-bottom"]');
    await expect(bottomBackBtn).toBeVisible({ timeout: 15000 });
    await bottomBackBtn.click();

    // 5. CRITICAL CHECK: Must return straight to homepage
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should display prominently highlighted arrow badges on navigation controls', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();
    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });

    // Verify top bar highlighted arrows
    await expect(page.locator('[data-testid="back-top-arrow-highlight"]')).toBeVisible({ timeout: 15000 });
    const nextArrow = page.locator('[data-testid="next-arrow-highlight"]');
    if (await nextArrow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(nextArrow).toBeVisible();
    }

    // Scroll to bottom and verify bottom highlighted arrows
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    await expect(page.locator('[data-testid="back-bottom-arrow-highlight"]')).toBeVisible({ timeout: 15000 });
    const nextBottomArrow = page.locator('[data-testid="next-bottom-arrow-highlight"]');
    if (await nextBottomArrow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(nextBottomArrow).toBeVisible();
    }
  });

  test('should restore previous homepage scroll position when navigating back from view details', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

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
    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');

    // 4. Click Back to Properties
    const topBackBtn = page.locator('[data-testid="back-to-properties-top"]');
    await expect(topBackBtn).toBeVisible({ timeout: 15000 });
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
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on the first property
    const firstDetailsLink = page.locator('a:has-text("View full details")').first();
    await expect(firstDetailsLink).toBeVisible({ timeout: 15000 });
    await firstDetailsLink.click();

    await expect(page).toHaveURL(/.*\/site\/.+/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');

    // 3. Check TUDA Approved status element and row
    const tudaItem = page.locator('[data-testid="tuda-approved-item"]');
    await expect(tudaItem).toBeVisible({ timeout: 15000 });
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
    await page.waitForLoadState('domcontentloaded');

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
    await page.waitForLoadState('domcontentloaded');

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
    await page.waitForLoadState('domcontentloaded');

    // 6. Verify prefetch is automatically triggered because idx (2) >= length (3) - 3 (0)
    await expect.poll(() => prefetchCalled, { timeout: 10000 }).toBe(true);

    // 7. Verify Next button is active and links to PREFETCH-4 (the prefetched property)
    const nextBtnTop = page.locator('a[data-testid="next-property-top"]');
    await expect(nextBtnTop).toBeVisible({ timeout: 5000 });
    await expect(nextBtnTop).toHaveAttribute('href', '/site/PREFETCH-4');

    // 8. Click Next -> arrives at PREFETCH-4
    await nextBtnTop.click();
    await expect(page).toHaveURL(/.*\/site\/PREFETCH-4/);
    await page.waitForLoadState('domcontentloaded');

    // 9. Click Next again -> arrives at PREFETCH-5 (the final property)
    const nextBtnTop4 = page.locator('a[data-testid="next-property-top"]');
    await expect(nextBtnTop4).toHaveAttribute('href', '/site/PREFETCH-5');
    await nextBtnTop4.click();
    await expect(page).toHaveURL(/.*\/site\/PREFETCH-5/);
    await page.waitForLoadState('domcontentloaded');

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

  test('should retry on transient HTTP 500 during prefetchNextBatch and fetchSite and recover cleanly', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('HTTP 500')) {
        consoleErrors.push(msg.text());
      }
    });

    let detailCalls = 0;
    await page.route('**/api/sites/PREFETCH-RETRY-*', async (route) => {
      detailCalls += 1;
      const url = route.request().url();
      const codeMatch = url.match(/PREFETCH-RETRY-\d+/);
      const code = codeMatch ? codeMatch[0] : 'PREFETCH-RETRY-3';

      // First request returns transient HTTP 500, retry succeeds with 200
      if (detailCalls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Transient server error' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          site_code: code,
          name: `Retry Test Property ${code}`,
          location: 'Kuvempu Nagar',
          price: 2700000,
          area: 1200,
          dimension: '30x40',
          facing: 'East',
          tuda_approved: true,
          images: [],
        }),
      });
    });

    let prefetchCalls = 0;
    await page.route('**/api/sites/filter?*page=2*', async (route) => {
      prefetchCalls += 1;
      // First prefetch request returns HTTP 500, second attempt (retry) succeeds with 200
      if (prefetchCalls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Proxy socket hang up' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              site_code: 'PREFETCH-RETRY-4',
              name: 'Retry Test Property PREFETCH-RETRY-4',
              price: 2900000,
              location: 'Kuvempu Nagar',
            },
          ],
          total: 4,
        }),
      });
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      const initialFeed = {
        sites: [
          { site_code: 'PREFETCH-RETRY-1', name: 'Retry Test Property PREFETCH-RETRY-1', price: 2500000, location: 'Kuvempu Nagar' },
          { site_code: 'PREFETCH-RETRY-2', name: 'Retry Test Property PREFETCH-RETRY-2', price: 2600000, location: 'Kuvempu Nagar' },
          { site_code: 'PREFETCH-RETRY-3', name: 'Retry Test Property PREFETCH-RETRY-3', price: 2700000, location: 'Kuvempu Nagar' },
        ],
        total: 4,
        page: 1,
        hasMore: true,
        selectedLocations: ['Kuvempu Nagar'],
        selectedPrices: [],
        selectedAreas: [],
        selectedFacings: [],
        sortOption: '',
        appliedSearch: '',
        inputValue: '',
        isLayoutFilter: false,
      };
      sessionStorage.setItem('homeState', JSON.stringify(initialFeed));
    });

    await page.goto('http://localhost:3000/site/PREFETCH-RETRY-3');
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });

    // Verify retry occurred for both site detail and prefetchNextBatch
    await expect.poll(() => detailCalls, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => prefetchCalls, { timeout: 10000 }).toBe(2);

    // Verify Next button links to the recovered PREFETCH-RETRY-4 property
    const nextBtnTop = page.locator('a[data-testid="next-property-top"]');
    await expect(nextBtnTop).toBeVisible({ timeout: 10000 });
    await expect(nextBtnTop).toHaveAttribute('href', '/site/PREFETCH-RETRY-4');

    // Verify no HTTP 500 console.error was emitted
    expect(consoleErrors).toEqual([]);
  });

  test('should gracefully fall back to backend next_site without crashing when prefetch returns persistent HTTP 500', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('HTTP 500')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.route('**/api/sites/PREFETCH-FAIL-*', async (route) => {
      const url = route.request().url();
      const isFour = url.includes('PREFETCH-FAIL-4');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          site_code: isFour ? 'PREFETCH-FAIL-4' : 'PREFETCH-FAIL-3',
          name: isFour ? 'Backend Fallback Plot 4' : 'Initial End Plot 3',
          location: 'Kuvempu Nagar',
          price: 2800000,
          area: 1200,
          dimension: '30x40',
          facing: 'North',
          tuda_approved: true,
          images: [],
          next_site: isFour
            ? null
            : {
                site_code: 'PREFETCH-FAIL-4',
                name: 'Backend Fallback Plot 4',
                price: 2950000,
                location: 'Kuvempu Nagar',
              },
        }),
      });
    });

    let prefetchAttempts = 0;
    await page.route('**/api/sites/filter?*page=2*', async (route) => {
      prefetchAttempts += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Persistent HTTP 500' }),
      });
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      const initialFeed = {
        sites: [
          { site_code: 'PREFETCH-FAIL-1', name: 'Plot 1', price: 2500000, location: 'Kuvempu Nagar' },
          { site_code: 'PREFETCH-FAIL-2', name: 'Plot 2', price: 2600000, location: 'Kuvempu Nagar' },
          { site_code: 'PREFETCH-FAIL-3', name: 'Initial End Plot 3', price: 2800000, location: 'Kuvempu Nagar' },
        ],
        total: 5,
        page: 1,
        hasMore: true,
        selectedLocations: ['Kuvempu Nagar'],
        selectedPrices: [],
        selectedAreas: [],
        selectedFacings: [],
        sortOption: '',
        appliedSearch: '',
        inputValue: '',
        isLayoutFilter: false,
      };
      sessionStorage.setItem('homeState', JSON.stringify(initialFeed));
    });

    await page.goto('http://localhost:3000/site/PREFETCH-FAIL-3');
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 15000 });

    // Wait for background prefetch retry attempts to finish
    await expect.poll(() => prefetchAttempts, { timeout: 10000 }).toBeGreaterThanOrEqual(2);

    // Click Next button -> should gracefully fall back to backend next_site (PREFETCH-FAIL-4)
    const nextBtnTop = page.locator('[data-testid="next-property-top"]');
    await expect(nextBtnTop).toBeVisible({ timeout: 10000 });
    await nextBtnTop.click();
    await expect(page).toHaveURL(/.*\/site\/PREFETCH-FAIL-4/, { timeout: 15000 });
    // Confirm zero HTTP 500 console.error crashes
    expect(consoleErrors).toEqual([]);
  });

  test('should render site details instantaneously from homeState cache without blocking on slow API and avoid duplicate fetches', async ({ page }) => {
    let detailFetchCount = 0;

    // Simulate a slow backend (3.5s delay) for /api/sites/DUMMY-D3002B46
    await page.route('**/api/sites/DUMMY-D3002B46', async (route) => {
      detailFetchCount += 1;
      await new Promise((r) => setTimeout(r, 3500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          site_code: 'DUMMY-D3002B46',
          name: 'Instant Cached Plot D3002B46',
          location: 'Batawadi, Tumkur',
          price: 2450000,
          area: 1200,
          dimension: '30x40',
          facing: 'East',
          tuda_approved: true,
          images: [],
        }),
      });
    });

    await page.route('**/api/sites/visits', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('domcontentloaded');

    // Populate homeState and logged-in user in storage
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Fast Viewer', email: 'fast@tumkur.com' }));
      sessionStorage.setItem(
        'homeState',
        JSON.stringify({
          sites: [
            {
              site_code: 'DUMMY-D3002B46',
              name: 'Instant Cached Plot D3002B46',
              location: 'Batawadi, Tumkur',
              price: 2450000,
              area: 1200,
              dimension: '30x40',
              facing: 'East',
              tuda_approved: true,
              images: [],
            },
            {
              site_code: 'DUMMY-NEXT-01',
              name: 'Next Instant Plot',
              location: 'Sira Gate, Tumkur',
              price: 2800000,
              area: 1500,
            },
          ],
          total: 2,
          page: 1,
          hasMore: false,
        })
      );
    });

    // Navigate to /site/DUMMY-D3002B46 and verify content is visible BEFORE the 3.5s API response returns!
    await page.goto('http://localhost:3000/site/DUMMY-D3002B46', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="back-to-properties-top"]')).toBeVisible({ timeout: 1200 });
    await expect(page.locator('h1')).toContainText('Instant Cached Plot D3002B46', { timeout: 1200 });
    await expect(page.locator('a[data-testid="next-property-top"]')).toHaveAttribute('href', '/site/DUMMY-NEXT-01');

    // Wait briefly and confirm /api/sites/DUMMY-D3002B46 was called only ONCE (not duplicated by user hydration)
    await page.waitForTimeout(500);
    expect(detailFetchCount).toBe(1);
  });
});

