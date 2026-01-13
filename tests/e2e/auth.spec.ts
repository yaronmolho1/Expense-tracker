import { test, expect } from '@playwright/test';

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
    await expect(page.locator('h1')).toContainText('Login', { timeout: 5000 });
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
    await expect(page.locator('text=Invalid credentials, text=invalid, text=error').first()).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with correct credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    // Wait for form to be ready
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    
    // Fill in correct credentials (from .env)
    await page.fill('input[name="username"]', 'gili');
    await page.fill('input[name="password"]', 'y1a3r5o7n');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 15000 });
    
    // Should see dashboard content
    await expect(page.locator('text=Dashboard, h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should persist authentication after page refresh', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'gili');
    await page.fill('input[name="password"]', 'y1a3r5o7n');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });
    
    // Refresh the page
    await page.reload({ waitUntil: 'networkidle' });
    
    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator('text=Dashboard, h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'gili');
    await page.fill('input[name="password"]', 'y1a3r5o7n');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });
    
    // Find and click logout button (adjust selector based on your UI)
    // This might be in a dropdown or directly visible
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
    await logoutButton.waitFor({ timeout: 10000 });
    await logoutButton.click();
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login', { timeout: 10000 });
    
    // Try to access dashboard again
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Should be redirected back to login
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });

  test('should protect API routes from unauthenticated access', async ({ page, request }) => {
    // Make API request without auth token
    const response = await request.get('http://localhost:3000/api/dashboard');
    
    // Should return 401
    expect(response.status()).toBe(401);
  });

  test('should allow API access with valid token', async ({ page, request }) => {
    // Login to get token
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'gili');
    await page.fill('input[name="password"]', 'y1a3r5o7n');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });
    
    // Wait a bit for token to be stored
    await page.waitForTimeout(1000);
    
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
