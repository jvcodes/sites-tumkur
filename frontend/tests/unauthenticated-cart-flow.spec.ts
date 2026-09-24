import { test, expect } from '@playwright/test';

test.describe('Unauthenticated User Cart Booking Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Ensure completely unauthenticated state and clear storage
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
    });

    test('should allow unauthenticated user to add multiple sites, select date/time, login, and confirm booking immediately', async ({ page }) => {
        // 1. Inject multiple properties into the cart
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('cart', JSON.stringify([
                {
                    site_code: 'SEED-1420',
                    name: 'Greenfield Plots Tumkur',
                    location: 'Batawadi, Tumkur',
                    price: 2500000,
                    facing: 'East',
                    area: 1200,
                    dimension: '30x40',
                    images: ['/test-image-1.jpg'],
                },
                {
                    site_code: 'SEED-1421',
                    name: 'Sri Krishna Enclave',
                    location: 'S.S. Puram, Tumkur',
                    price: 3800000,
                    facing: 'North',
                    area: 1500,
                    dimension: '30x50',
                    images: ['/test-image-2.jpg'],
                }
            ]));
        });

        // 2. Navigate to /cart
        await page.goto('/cart');

        // Verify properties are visible
        await expect(page.getByText('Greenfield Plots Tumkur')).toBeVisible();
        await expect(page.getByText('Sri Krishna Enclave')).toBeVisible();
        await expect(page.getByText('2 Properties', { exact: true })).toBeVisible();

        // 3. Fill in booking date, time, and optional name before sign-in
        const testDate = '2026-10-15';
        const testTime = '11:00';
        await page.locator('input[type="date"]').fill(testDate);
        await page.locator('input[type="time"]').fill(testTime);
        await page.locator('input[placeholder="Enter your full name"]').fill('Tumkur Buyer');

        // 4. Click 'Sign in to Schedule'
        const scheduleBtn = page.locator('#submit-booking-btn');
        await expect(scheduleBtn).toContainText('Sign in to Schedule');
        await scheduleBtn.click();

        // 5. Verify redirection to /login with ?redirect=/cart
        await page.waitForURL(/\/login\?redirect=%2Fcart|\/login\?redirect=\/cart/);
        expect(page.url()).toContain('redirect=');

        // 6. Complete phone authentication with dev bypass
        await page.locator('input[name="phone"]').fill('7353565562');
        await page.getByRole('button', { name: /Get OTP|Send OTP/i }).click();

        // OTP input should appear
        const otpInput = page.locator('input[name="otp"]');
        await expect(otpInput).toBeVisible({ timeout: 10000 });
        await otpInput.fill('123456');
        await page.getByRole('button', { name: /Verify & Sign In|Verify/i }).click();

        // 7. Verify redirection back to /cart (NOT '/' and NOT '/profile')
        await page.waitForURL(/\/cart/, { timeout: 10000 });
        expect(page.url()).not.toContain('/profile');
        expect(page.url()).toContain('/cart');

        // 8. Verify that immediate booking completes and Booking Confirmed receipt is rendered
        await expect(page.getByText('Booking Confirmed!')).toBeVisible({ timeout: 12000 });
        await expect(page.getByText(/BK\d+/)).toBeVisible();
        await expect(page.locator('.max-w-2xl').getByText('Tumkur Buyer')).toBeVisible();
        await expect(page.locator('.max-w-2xl').getByText('Greenfield Plots Tumkur')).toBeVisible();
        await expect(page.locator('.max-w-2xl').getByText('Sri Krishna Enclave')).toBeVisible();
    });

    test('should allow user to enter name inline on cart without getting kicked to /profile', async ({ page }) => {
        // Mock user logged in via phone but without a profile name yet
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('token', 'dev-token');
            localStorage.setItem('user', JSON.stringify({
                id: 99,
                username: '7353565562',
                phone: '7353565562',
                name: '',
                role: 'Buyer'
            }));
            localStorage.setItem('cart', JSON.stringify([
                {
                    site_code: 'SEED-1420',
                    name: 'Greenfield Plots Tumkur',
                    location: 'Batawadi, Tumkur',
                    price: 2500000,
                    images: ['/test-image-1.jpg'],
                }
            ]));
        });

        await page.goto('/cart');

        // Verify user is recognized on cart page
        await expect(page.getByText('7353565562')).toBeVisible();
        await expect(page.getByText('Verified')).toBeVisible();

        // Fill in date, time, and name inline
        await page.locator('input[type="date"]').fill('2026-10-20');
        await page.locator('input[type="time"]').fill('14:30');
        
        const nameInput = page.locator('input[placeholder="Enter your full name"]');
        await expect(nameInput).toBeVisible();
        await nameInput.fill('Dr. Ramesh Rao');

        // Click Confirm Booking Request
        const confirmBtn = page.locator('#submit-booking-btn');
        await expect(confirmBtn).toContainText('Confirm Booking Request');
        await confirmBtn.click();

        // Must NOT redirect away to /profile
        await expect(page.getByText('Booking Confirmed!')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Dr. Ramesh Rao')).toBeVisible();
        expect(page.url()).toContain('/cart');
    });
});
