import { test, expect } from '@playwright/test';

test.describe('Admin Hub & Subpages E2E', () => {
  test('should render Admin Hub dashboard with all stat cards and quick actions', async ({ page }) => {
    // Navigate directly to Django Admin Hub
    await page.goto('http://127.0.0.1:8000/admin/hub/');
    await page.waitForLoadState('domcontentloaded');

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
    await page.goto('/admin/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1')).toContainText('Admin Dashboard');
    await expect(page.locator('.stat-card', { hasText: 'Real Sites' })).toBeVisible();
  });

  test('should navigate to all core admin subpages without error', async ({ page }) => {
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
});
