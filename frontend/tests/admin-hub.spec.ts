import { test, expect, Page } from '@playwright/test';

async function loginToAdmin(page: Page, targetUrl = 'http://127.0.0.1:8000/admin/hub/') {
  await page.goto(targetUrl);
  await page.waitForLoadState('domcontentloaded');

  const loginForm = page.locator('[data-testid="admin-login-form"]');
  if (await loginForm.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.locator('[data-testid="admin-username-input"]').fill('admin');
    await page.locator('[data-testid="admin-password-input"]').fill('tumkur@2026');
    await Promise.all([
      page.waitForURL((url) => !url.pathname.includes('/admin/login'), { timeout: 15000, waitUntil: 'domcontentloaded' }),
      page.locator('[data-testid="admin-login-submit"]').click(),
    ]);
    await page.waitForLoadState('domcontentloaded');
  }
}

test.describe('Admin Hub & Subpages E2E', () => {
  test('should require login for unauthenticated visitors, reject invalid password, and allow valid login + logout', async ({ page }) => {
    // 1. Navigating to a protected admin route redirects to /admin/login/
    await page.goto('http://127.0.0.1:8000/admin/hub/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*\/admin\/login\/.*/);
    await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible();

    // 2. Invalid credentials show error message
    await page.locator('[data-testid="admin-username-input"]').fill('admin');
    await page.locator('[data-testid="admin-password-input"]').fill('wrongpass');
    await page.locator('[data-testid="admin-login-submit"]').click();
    await expect(page.locator('[data-testid="admin-login-error"]')).toBeVisible();

    // 3. Valid credentials authenticate and redirect to Admin Dashboard
    await page.locator('[data-testid="admin-username-input"]').fill('admin');
    await page.locator('[data-testid="admin-password-input"]').fill('tumkur@2026');
    await page.locator('[data-testid="admin-login-submit"]').click();
    await expect(page.locator('h1')).toContainText('Admin Dashboard');

    // 4. Logout clears session and returns to login screen
    await page.goto('http://127.0.0.1:8000/admin/logout/');
    await expect(page).toHaveURL(/.*\/admin\/login\/.*/);
    await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible();
  });

  test('should render Admin Hub dashboard with all stat cards and quick actions', async ({ page }) => {
    await loginToAdmin(page, 'http://127.0.0.1:8000/admin/hub/');

    // 1. Verify Header and Subtitle
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
    await expect(page.locator('text=Full control center for SiteHub operations.')).toBeVisible();

    // 2. Verify Stat Cards
    await expect(page.locator('.stat-card', { hasText: 'Real Sites' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Test Mockups' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Pending Visits' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Pending Review' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Active Agents' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Total Bookings' })).toBeVisible();

    // 3. Verify Quick Action Links
    await expect(page.locator('.quick-link', { hasText: 'Manage & Edit Properties' })).toBeVisible();
    await expect(page.locator('.quick-link', { hasText: 'Approve / Reject Sites' })).toBeVisible();
    await expect(page.locator('.quick-link', { hasText: 'Upload a Site Listing' })).toBeVisible();
    await expect(page.locator('.quick-link', { hasText: 'Visit Approvals' })).toBeVisible();
    await expect(page.locator('.quick-link', { hasText: 'SiteHub Agent Portal' })).toBeVisible();
    await expect(page.locator('.quick-link', { hasText: 'Manage Landmarks' })).toBeVisible();

    // 4. Verify Recent Bookings Section
    await expect(page.locator('h2', { hasText: 'Recent Pending Visits' })).toBeVisible();
  });

  test('should render Admin Hub through Next.js proxy route /admin/', async ({ page }) => {
    await loginToAdmin(page, '/admin/');

    await expect(page.locator('h1')).toContainText('Admin Dashboard');
    await expect(page.locator('.stat-card', { hasText: 'Real Sites' })).toBeVisible();
  });

  test('should support responsive mobile navigation with drawer and touch-friendly controls', async ({ page }) => {
    // Mobile Viewport (iPhone SE / Standard Phone)
    await page.setViewportSize({ width: 375, height: 667 });
    await loginToAdmin(page, 'http://127.0.0.1:8000/admin/hub/');

    // 1. Mobile top bar is visible, desktop aside is hidden
    const menuToggle = page.locator('#admin-menu-toggle');
    await expect(menuToggle).toBeVisible();
    await expect(page.locator('aside')).toBeHidden();

    // 2. Open Mobile Menu Drawer
    await menuToggle.click();
    const drawer = page.locator('#mobile-admin-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('text=Dashboard')).toBeVisible();
    await expect(drawer.locator('text=All Properties')).toBeVisible();
    await expect(drawer.locator('[data-testid="admin-logout-mobile"]')).toBeVisible();

    // 3. Close Drawer via overlay or close button
    const closeBtn = drawer.locator('button[aria-label="Close menu"]');
    await closeBtn.click();
    await expect(drawer).toHaveClass(/.*-translate-x-full.*/);

    // 4. Stat cards are rendered cleanly in mobile 2-column grid
    await expect(page.locator('.stat-card', { hasText: 'Real Sites' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Total Bookings' })).toBeVisible();
  });

  test('should support desktop layout with full sidebar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Skip desktop-specific layout assertion on mobile emulation devices');

    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginToAdmin(page, 'http://127.0.0.1:8000/admin/hub/');

    // Desktop aside is visible, mobile menu toggle is hidden
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('#admin-menu-toggle')).toBeHidden();
    await expect(page.locator('aside').locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('[data-testid="admin-logout-desktop"]')).toBeVisible();
  });

  test('should navigate to all core admin subpages without error', async ({ page }) => {
    await loginToAdmin(page, 'http://127.0.0.1:8000/admin/hub/');

    // 1. Manage Sites / Uploaded Sites
    await page.goto('http://127.0.0.1:8000/admin/sites/pending/?status=all');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1', { hasText: 'Uploaded Sites' })).toBeVisible();

    // 2. Manage Landmarks
    await page.goto('http://127.0.0.1:8000/admin/landmarks/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('text=Manage Key Landmarks')).toBeVisible();

    // 3. Manage Agents
    await page.goto('http://127.0.0.1:8000/admin/agents/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1', { hasText: 'Manage Agents' })).toBeVisible();

    // 4. Bookings Management
    await page.goto('http://127.0.0.1:8000/admin/bookings/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1', { hasText: 'Visit Bookings' })).toBeVisible();

    // 5. Upload Site Page
    await page.goto('http://127.0.0.1:8000/admin/sites/upload/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1', { hasText: 'Upload a Site Listing' })).toBeVisible();
  });

  test('should open root /admin/ with phone username and navigate back from site review page quickly', async ({ page }) => {
    // 1. Open root /admin/ URL directly -> redirects to /admin/login/?next=%2Fadmin%2F
    await page.goto('http://127.0.0.1:8000/admin/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*\/admin\/login\/.*/);

    // 2. Log in using phone number 7353565562
    await page.locator('[data-testid="admin-username-input"]').fill('7353565562');
    await page.locator('[data-testid="admin-password-input"]').fill('tumkur@2026');
    await Promise.all([
      page.waitForURL((url) => !url.pathname.includes('/admin/login'), { timeout: 15000, waitUntil: 'domcontentloaded' }),
      page.locator('[data-testid="admin-login-submit"]').click(),
    ]);
    await expect(page.locator('h1')).toContainText('Admin Dashboard');

    // 3. Navigate to All Properties and open a Site Review page, then click Back
    await page.goto('http://127.0.0.1:8000/admin/sites/pending/?status=all');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1', { hasText: 'Uploaded Sites' })).toBeVisible();

    const firstEditLink = page.locator('a[href*="/admin/sites/review/"]').first();
    if (await firstEditLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstEditLink.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/.*\/admin\/sites\/review\/.+/);

      // Click the Back button in the top sticky bar and verify it returns to /admin/sites/pending/
      const backBtn = page.locator('a[href*="/admin/sites/pending/"]').first();
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/.*\/admin\/sites\/pending\/.*/);
      await expect(page.locator('h1', { hasText: 'Uploaded Sites' })).toBeVisible();
    }
  });
});
