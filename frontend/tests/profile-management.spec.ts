import { test, expect } from '@playwright/test';

test.describe('Profile Management & Large Lists E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Authenticate with a phone number (typical Tumkur user)
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('token', 'mock-phone-jwt-token');
            localStorage.setItem('user', JSON.stringify({
                id: 42,
                username: '7353565562',
                phone: '7353565562',
                name: 'Tumkur Investor',
                email: '',
                role: 'Buyer'
            }));
        });
    });

    test('should display dashboard overview stats and allow phone-auth user to update mobile number', async ({ page }) => {
        // Mock profile fetch
        await page.route('**/api/auth/profile/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'Tumkur Investor',
                    phone: '7353565562',
                    email: '',
                    role: 'Buyer',
                    created_at: '2026-01-01T00:00:00Z'
                })
            });
        });

        // Mock counts
        await page.route('**/api/sites/visits/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ site_code: 'S-1', visit_date: '2026-09-01' }])
            });
        });
        await page.route('**/api/bookings/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 'b-1', date: '2026-09-10', status: 'approved' }])
            });
        });
        await page.route('**/api/sites/my-sites*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        // Mock phone update
        let phoneUpdatePayload: any = null;
        await page.route('**/api/auth/update-phone', async (route) => {
            phoneUpdatePayload = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Phone number updated successfully', phone: '9876543210' })
            });
        });

        await page.goto('/profile');

        // Check dashboard counters are visible
        await expect(page.locator('h1', { hasText: 'My Dashboard' })).toBeVisible();
        await expect(page.locator('text=Properties Viewed')).toBeVisible();
        await expect(page.locator('text=Visits Scheduled')).toBeVisible();

        // Edit mobile number
        const editPhoneBtn = page.locator('button', { hasText: 'Edit' }).last();
        await editPhoneBtn.click();

        const phoneInput = page.locator('input[type="tel"]');
        await expect(phoneInput).toBeVisible();
        await phoneInput.fill('9876543210');

        await page.locator('button', { hasText: 'Save' }).click();

        await expect(page.locator('text=Mobile number saved!')).toBeVisible();
        expect(phoneUpdatePayload).not.toBeNull();
        expect(phoneUpdatePayload.phone).toBe('9876543210');
        expect(phoneUpdatePayload.identifier).toBe('7353565562');
    });

    test('should handle large list of booked visits with status tabs and pagination', async ({ page }) => {
        // Generate 12 mock bookings
        const mockBookings = Array.from({ length: 12 }, (_, i) => ({
            id: `bk-${i + 1}`,
            date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
            time: '10:00 AM',
            created_at: '2026-09-15T10:00:00Z',
            status: i < 4 ? 'pending' : i < 8 ? 'approved' : i < 10 ? 'completed' : 'rejected',
            broker_name: i % 2 === 0 ? 'Ramesh Broker' : 'Suresh Agent',
            sites: [
                {
                    site_code: `TUM-${100 + i}`,
                    name: `Plot ${100 + i} S.S. Puram`,
                    location: 'Tumkur',
                    price: 3500000 + i * 50000
                },
                {
                    site_code: `TUM-${200 + i}`,
                    name: `Layout Site ${200 + i}`,
                    location: 'Kyatsandra',
                    price: 2500000
                },
                {
                    site_code: `TUM-${300 + i}`,
                    name: `Corner Site ${300 + i}`,
                    location: 'Batawadi',
                    price: 4500000
                }
            ]
        }));

        await page.route('**/api/bookings/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockBookings)
            });
        });

        await page.goto('/profile/booked');

        // Verify page header and overall count
        await expect(page.locator('h1', { hasText: 'Booked for Visit' })).toBeVisible();
        await expect(page.locator('text=12 Total Bookings')).toBeVisible();

        // Check tabs exist
        await expect(page.getByRole('button', { name: /^All/ })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Upcoming & Pending' })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Completed' })).toBeVisible();
        await expect(page.locator('button', { hasText: 'Cancelled / Rejected' })).toBeVisible();

        // Check pagination is active (5 per page, so 3 pages total)
        await expect(page.locator('text=Showing 1–5 of 12 bookings')).toBeVisible();
        await expect(page.locator('text=Page 1 of 3').first()).toBeVisible();

        // Click Next page
        await page.locator('button', { hasText: 'Next →' }).click();
        await expect(page.locator('text=Showing 6–10 of 12 bookings')).toBeVisible();
        await expect(page.locator('text=Page 2 of 3').first()).toBeVisible();

        // Switch to "Completed" tab
        await page.locator('button', { hasText: 'Completed' }).click();
        // 2 completed items, so no page 2
        await expect(page.locator('text=Showing 1–2 of 2 bookings')).toBeVisible();

        // Check multi-site expand button
        const expandBtn = page.locator('button', { hasText: '+ Show All 3 Sites ▾' }).first();
        await expect(expandBtn).toBeVisible();
        await expandBtn.click();
        await expect(page.locator('button', { hasText: 'Show Less ▴' }).first()).toBeVisible();
    });

    test('should handle large list of viewed visits with sorting and pagination', async ({ page }) => {
        // Generate 15 viewed sites
        const mockVisits = Array.from({ length: 15 }, (_, i) => ({
            site_code: `VIEW-${100 + i}`,
            name: `Tumkur Prime Site ${i + 1}`,
            location: i % 2 === 0 ? 'S.S. Puram, Tumkur' : 'Kyatsandra, Tumkur',
            price: 2000000 + i * 100000,
            area: 1200 + i * 100,
            visit_date: `2026-09-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
            status: 'approved'
        }));

        await page.route('**/api/sites/visits/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockVisits)
            });
        });

        await page.goto('/profile/visits');

        await expect(page.locator('h1', { hasText: 'My Viewed Sites' })).toBeVisible();
        await expect(page.locator('text=15 Properties Viewed')).toBeVisible();

        // 6 per page, so 3 pages total
        await expect(page.locator('text=Showing 1–6 of 15 viewed properties')).toBeVisible();
        await expect(page.locator('text=Page 1 of 3').first()).toBeVisible();

        // Search filter
        const searchInput = page.locator('input[placeholder*="Search viewed sites"]');
        await searchInput.fill('VIEW-101');
        await expect(page.locator('text=Showing 1–1 of 1 viewed properties')).toBeVisible();
        await expect(page.locator('text=VIEW-101')).toBeVisible();
    });

    test('should cleanly logout from sidebar and clear localStorage', async ({ page }) => {
        await page.goto('/profile');

        const logoutBtn = page.locator('button:visible', { hasText: 'Log Out' }).first();
        await expect(logoutBtn).toBeVisible();
        await logoutBtn.dispatchEvent('click');

        // Verify redirection to /login
        await page.waitForURL('**/login**');

        // Verify token and user removed from localStorage
        const storedToken = await page.evaluate(() => localStorage.getItem('token'));
        const storedUser = await page.evaluate(() => localStorage.getItem('user'));
        expect(storedToken).toBeNull();
        expect(storedUser).toBeNull();
    });

    test('should validate invalid phone formats and prevent API submission', async ({ page }) => {
        let apiCalled = false;
        await page.route('**/api/auth/profile/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'Tumkur Investor',
                    phone: '7353565562',
                    email: '',
                    role: 'Buyer',
                    created_at: '2026-01-01T00:00:00Z'
                })
            });
        });
        await page.route('**/api/auth/update-phone', async (route) => {
            apiCalled = true;
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        });

        await page.goto('/profile');
        const editPhoneBtn = page.locator('button', { hasText: 'Edit' }).last();
        await editPhoneBtn.click();

        const phoneInput = page.locator('input[type="tel"]');
        await expect(phoneInput).toBeVisible();

        // Submitting too short digits (< 10)
        await phoneInput.fill('12345');
        await page.locator('button', { hasText: 'Save' }).click();
        await expect(page.locator('text=Enter a valid 10-digit Indian mobile number.')).toBeVisible();
        expect(apiCalled).toBe(false);

        // Submitting non-Indian prefix (starts with 2-5)
        await phoneInput.fill('3333333333');
        await page.locator('button', { hasText: 'Save' }).click();
        await expect(page.locator('text=Enter a valid 10-digit Indian mobile number.')).toBeVisible();
        expect(apiCalled).toBe(false);
    });

    test('should handle special characters in visits and bookings search gracefully without crashing', async ({ page }) => {
        const mockVisits = [
            {
                site_code: 'SPEC-01',
                name: 'Tumkur Special Plot',
                location: 'Batawadi',
                price: 2500000,
                visit_date: '2026-09-15T10:00:00Z'
            }
        ];
        await page.route('**/api/sites/visits/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockVisits)
            });
        });

        await page.goto('/profile/visits');
        const searchInput = page.locator('input[placeholder*="Search viewed sites"]');
        await searchInput.fill('!@#$%^&*()');

        // Verify graceful empty state without crash
        await expect(page.locator('text=No viewed properties match "!@#$%^&*()".')).toBeVisible();
        await page.locator('button', { hasText: 'Clear search' }).click();
        await expect(page.locator('text=SPEC-01')).toBeVisible();

        // Test in Booked Visits
        await page.route('**/api/bookings/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'bk-spec',
                        date: '2026-10-10',
                        status: 'pending',
                        sites: [{ site_code: 'SPEC-01', name: 'Tumkur Special Plot', location: 'Batawadi' }]
                    }
                ])
            });
        });

        await page.goto('/profile/booked');
        const bookedSearch = page.locator('input[placeholder*="Filter bookings"]');
        await bookedSearch.fill('<script>alert("xss")</script>');
        await expect(page.locator('text=No bookings match your current filter.')).toBeVisible();
        await page.locator('button', { hasText: 'Reset filters' }).click();
        await expect(page.locator('text=SPEC-01')).toBeVisible();
    });

    test('should render responsive pagination for large page counts without display overflow', async ({ page }) => {
        // 60 visits => 10 pages
        const mockVisits = Array.from({ length: 60 }, (_, i) => ({
            site_code: `TUM-PAGE-${i + 1}`,
            name: `Tumkur Plot ${i + 1}`,
            location: 'Kunigal Road, Tumkur',
            price: 2000000 + i * 10000,
            visit_date: '2026-09-10T10:00:00Z'
        }));

        await page.route('**/api/sites/visits/me*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockVisits)
            });
        });

        await page.goto('/profile/visits');

        // Verify total count and page 1
        await expect(page.locator('text=Showing 1–6 of 60 viewed properties')).toBeVisible();
        await expect(page.locator('text=Page 1 of 10').first()).toBeVisible();

        // Navigate forward
        await page.locator('button', { hasText: 'Next →' }).click();
        await expect(page.locator('text=Showing 7–12 of 60 viewed properties')).toBeVisible();
        await expect(page.locator('text=Page 2 of 10').first()).toBeVisible();

        // Navigate backward
        await page.locator('button', { hasText: '← Previous' }).click();
        await expect(page.locator('text=Showing 1–6 of 60 viewed properties')).toBeVisible();
        await expect(page.locator('text=Page 1 of 10').first()).toBeVisible();
    });

    test('should enforce authorization and block cross-user site edit attempt', async ({ page }) => {
        // Property owned by another user
        await page.route('**/api/sites/UNAUTHORIZED-99', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    site_code: 'UNAUTHORIZED-99',
                    name: 'Private Estate Plot',
                    location: 'S.S. Puram, Tumkur',
                    price: 8500000,
                    owner: 'Rival Seller',
                    user_id: 'rival_seller@example.com'
                })
            });
        });

        await page.goto('/site/UNAUTHORIZED-99/edit');

        // Verify unauthorized access message
        await expect(page.locator('text=You are not authorized to edit this site.')).toBeVisible();
        // Edit form should not be present
        await expect(page.locator('input[name="name"]')).not.toBeVisible();
        await expect(page.locator('button', { hasText: 'Return to Site' })).toBeVisible();
    });
});
