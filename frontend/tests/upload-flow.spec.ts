import { test, expect } from '@playwright/test';

test.describe('SiteHub Upload Flow', () => {
  test('should validate empty form fields', async ({ page, context }) => {
    // Mock user login
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test User', email: 'test@example.com' }));
    });

    await page.goto('/upload-site');

    // Attempt to submit an empty form
    await page.getByRole('button', { name: 'Publish Site' }).click();

    // The browser's native HTML5 validation will trigger, preventing submission.
    // Playwright doesn't easily assert on native popup bubbles for "required" attributes, 
    // so we verify that the form didn't navigate away and we are still on the upload page.
    expect(page.url()).toContain('/upload-site');
  });

  test('should fill out upload form and trigger mock location', async ({ page, context }) => {
    // Mock the geolocation API for this test
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 }); // Bangalore coords

    // Mock user login
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test User', email: 'test@example.com' }));
    });

    await page.goto('/upload-site');

    // Fill in required fields
    await page.getByPlaceholder('e.g. Silver Oak Layout').fill('Test Upload Site');
    
    // In Next.js, handling file uploads with Playwright is done using setInputFiles
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('mock image data')
    });

    // Test location button
    await page.getByRole('button', { name: '📍 Use Current Location' }).click();
    
    // Verify latitude and longitude get filled with our mocked Bangalore coords
    await expect(page.locator('input[name="latitude"]')).toHaveValue('12.9716');
    await expect(page.locator('input[name="longitude"]')).toHaveValue('77.5946');

    // Because this hits a real API without a mock token (and without login), 
    // we stop short of actually submitting to avoid database pollution or 401s in CI.
  });
});
