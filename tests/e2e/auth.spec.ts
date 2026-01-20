import { test, expect } from '@playwright/test';
import { loginViaUI } from './helpers/auth-helpers';

/**
 * E2E Tests: Authentication Flow
 *
 * Tests the complete authentication flow including login, logout,
 * and protected route access.
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and localStorage before each test
    await page.context().clearCookies();
    // Don't navigate to '/' here as it redirects and can cause issues
    // Each test will navigate to the specific page it needs
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Should redirect to login page (may have query params like ?from=%2F)
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // Better check - verify login form is present
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 5000 });
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    // Wait for form to be ready
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    
    // Fill in wrong credentials
    await page.fill('input[name="username"]', 'wronguser');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with correct credentials', async ({ page }) => {
    await loginViaUI(page);
    
    // Should see dashboard content (main page loaded, not login)
    await expect(page.locator('input[name="username"]')).not.toBeVisible();
  });

  test('should persist authentication after page refresh', async ({ page }) => {
    // Login first
    await loginViaUI(page);
    
    // Refresh the page
    await page.reload({ waitUntil: 'networkidle' });
    
    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL('/', { timeout: 10000 });
    // Verify still authenticated (not showing login form)
    await expect(page.locator('input[name="username"]')).not.toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginViaUI(page);
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Find logout button (it's in the header on desktop or nav menu on mobile)
    // Try header button first (desktop), then nav menu (mobile)
    const logoutButton = page.locator('button:has-text("Logout")').first();
    await logoutButton.waitFor({ timeout: 10000 });
    await logoutButton.click();
    
    // Click confirm in alert dialog
    const confirmButton = page.locator('button:has-text("Logout")').last();
    await confirmButton.waitFor({ timeout: 5000 });
    await confirmButton.click();
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login', { timeout: 10000 });
    
    // Try to access dashboard again
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Should be redirected back to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should protect API routes from unauthenticated access', async ({ page, request }) => {
    // Make API request without auth token
    const response = await request.get('http://localhost:3000/api/dashboard');
    
    // Should return 401
    expect(response.status()).toBe(401);
  });

  test('should allow API access with valid token', async ({ page, request }) => {
    // Login to get token
    await loginViaUI(page);
    
    // Get token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    
    // Make API request with token
    const response = await request.get('http://localhost:3000/api/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Should return 200
    expect(response.status()).toBe(200);
  });
});
