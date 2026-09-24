import { test, expect } from '@playwright/test';

test.describe('SiteHub My Sites Page', () => {
    test.beforeEach(async ({ page }) => {
        // Mock authentication for a phone user
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('token', 'mock-token');
            localStorage.setItem('user', JSON.stringify({
                id: 1,
                username: '9999999999',
                phone: '9999999999',
                name: 'New User',
                email: '',
                role: 'Buyer'
            }));
        });
    });

    test('should load my-sites for a phone user and pass user.phone as user_id', async ({ page }) => {
        let requestUrl = '';
        await page.route('**/api/sites/my-sites*', async (route) => {
            requestUrl = route.request().url();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        site_code: 'TEST-1234',
                        name: 'Mock Uploaded Site',
                        location: 'Mock Location',
                        area: 1200,
                        price: 5000000,
                        status: 'pending'
                    }
                ])
            });
        });

        await page.goto('/profile/my-sites');

        // Check if loading state vanishes and content appears
        await expect(page.locator('h1', { hasText: 'My Uploaded Sites' })).toBeVisible({ timeout: 10000 });
        
        // Wait for API call to complete
        await expect(page.locator('td', { hasText: 'TEST-1234' })).toBeVisible();
        await expect(page.locator('td', { hasText: 'Mock Location' })).toBeVisible();

        // Verify the API call contained the phone number as user_id
        expect(requestUrl).toContain('user_id=9999999999');
    });

    test('should show empty state if no sites uploaded', async ({ page }) => {
        await page.route('**/api/sites/my-sites*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        await page.goto('/profile/my-sites');

        await expect(page.locator('text=You haven\'t uploaded any sites yet.')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button', { hasText: 'Upload a Site' })).toBeVisible();
    });

    test('should show Edit Property buttons when user has admin role', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('user', JSON.stringify({
                id: 1,
                username: 'admin',
                phone: '9999999999',
                name: 'Admin User',
                email: 'admin@sitehub.com',
                role: 'admin'
            }));
        });

        await page.route('**/api/sites/SITE-ADMIN-TEST', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    site_code: 'SITE-ADMIN-TEST',
                    name: 'Admin Test Site',
                    location: 'Tumkur',
                    price: 2500000,
                    area: 1200,
                    dimension: '30x40',
                    facing: 'East',
                    status: 'approved',
                    user_id: 'other-user@example.com'
                })
            });
        });

        await page.goto('/site/SITE-ADMIN-TEST');

        const topEditBtn = page.locator('[data-testid="edit-property-top-btn"]');
        await expect(topEditBtn).toBeVisible({ timeout: 10000 });

        const badgeEditBtn = page.locator('[data-testid="edit-property-badge-btn"]');
        await expect(badgeEditBtn).toBeVisible();

        const sidebarEditBtn = page.locator('[data-testid="edit-property-sidebar-btn"]');
        await expect(sidebarEditBtn).toBeVisible();
    });
});
