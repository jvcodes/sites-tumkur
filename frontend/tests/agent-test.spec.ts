import { test, expect } from '@playwright/test';

test.describe('Agent Manual Testing', () => {
  test('Login and interact with Layout and Map', async ({ page, context }) => {
    // 1. Visit Homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '../agent_test_1_homepage.png' });

    // Mock Login (Firebase UI is an iframe, mocking localStorage is more reliable for headless tests)
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, phone: '+919538536334', name: 'Agent Tester' }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '../agent_test_2_logged_in.png' });

    // 2. Test Layout Filter
    await page.getByText('Layout / Gated Community').click();
    await page.waitForTimeout(1000); // Wait for API fetch
    await page.screenshot({ path: '../agent_test_3_layout_filter.png' });

    // 3. Test Upload Page Map & Drafts
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });

    await page.goto('http://localhost:3000/upload-site');
    await page.waitForLoadState('domcontentloaded');
    
    // Fill basic details
    await page.getByPlaceholder('e.g. Silver Oak Layout').fill('Agent Automated Upload');
    await page.locator('input[name="price"]').fill('1500000');
    
    // Toggle Layout
    await page.getByLabel('Is this part of a Layout / Gated Community?').check();
    await page.locator('input[name="layout_name"]').fill('Agent Layout');
    await page.screenshot({ path: '../agent_test_4_upload_form.png' });

    // Get location
    await page.getByRole('button', { name: '📍 Use Current Location' }).click();
    await page.waitForTimeout(1000); // Wait for map to pan
    await page.screenshot({ path: '../agent_test_5_map_location.png' });
  });
});
