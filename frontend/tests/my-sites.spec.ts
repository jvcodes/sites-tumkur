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

    test('should load all editable fields in edit page and save successfully', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('user', JSON.stringify({
                id: 1,
                username: 'admin',
                phone: '9999999999',
                name: 'Admin User',
                email: 'admin@sitehub.com',
                role: 'admin'
            }));
            localStorage.setItem('token', 'dev-auth-token-12345');
        });

        await page.route('**/api/sites/SITE-EDIT-ALL*', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        site_code: 'SITE-EDIT-ALL',
                        name: 'Test Comprehensive Plot',
                        location: 'Tumkur East',
                        price: 3500000,
                        area: 1500,
                        dimension: '30x50',
                        facing: 'East',
                        road_width: '40 ft',
                        landmark: 'Near Bus Stop',
                        category: 'Residential Plot',
                        owner: 'Owner Ramesh',
                        uploaded_phone: '9876543210',
                        latitude: 13.34,
                        longitude: 77.10,
                        youtube_url: 'https://youtube.com/watch?v=sample',
                        description: 'Detailed description test',
                        status: 'approved',
                        corner_site: true,
                        boundary_marked: true,
                        levelled_land: true,
                        negotiable: true,
                        loan_facility: true,
                        tuda_approved: true,
                        a_khata: true,
                        clear_title: true,
                        bank_loan_approved: true,
                        layout_approved: true,
                        borewell_water: true,
                        electricity_nearby: true,
                        drainage_connection: true,
                        asphalt_road_access: true,
                        nearby_landmarks: [
                            { landmark: 'Tumkur Station', distance_km: 2.0 }
                        ]
                    })
                });
            } else {
                await route.continue();
            }
        });

        let submittedPayload: any = null;
        await page.route(new RegExp('/api/sites/update-by-code/SITE-EDIT-ALL'), async (route) => {
            submittedPayload = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Updated' })
            });
        });

        await page.goto('/site/SITE-EDIT-ALL/edit');

        // Check header and form title
        await expect(page.locator('text=Edit Property Details')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('input[name="name"]')).toHaveValue('Test Comprehensive Plot');
        await expect(page.locator('input[name="road_width"]')).toHaveValue('40 ft');
        await expect(page.locator('input[name="landmark"]')).toHaveValue('Near Bus Stop');
        await expect(page.locator('input[name="uploaded_phone"]')).toHaveValue('9876543210');
        await expect(page.locator('input[name="youtube_url"]')).toHaveValue('https://youtube.com/watch?v=sample');
        await expect(page.locator('input[name="corner_site"]')).toBeChecked();
        await expect(page.locator('input[name="tuda_approved"]')).toBeChecked();
        await expect(page.locator('input[name="borewell_water"]')).toBeChecked();
        await expect(page.locator('input[value="Tumkur Station"]')).toBeVisible();

        // Submit form
        await page.locator('button[type="submit"]', { hasText: 'Save All Changes' }).click();

        // Verify success message
        await expect(page.locator('text=Site updated successfully!')).toBeVisible({ timeout: 5000 });
        expect(submittedPayload).not.toBeNull();
        expect(submittedPayload.name).toBe('Test Comprehensive Plot');
        expect(submittedPayload.road_width).toBe('40 ft');
        expect(submittedPayload.corner_site).toBe(true);
        expect(submittedPayload.tuda_approved).toBe(true);
    });
});
