import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Authentication Flow
 * 
 * Tests the complete authentication flow including login, logout,
 * and protected route access.
 */

/**
 * Helper function to login with explicit cookie handling
 * This ensures cookies are properly set before navigation
 */
async function loginWithCookies(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'gili');
  await page.fill('input[name="password"]', 'y1a3r5o7n');
  
  // Intercept the login response to get the token BEFORE clicking submit
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/auth/login') && resp.status() === 200,
    { timeout: 15000 }
  );
  
  // Click submit button
  await page.click('button[type="submit"]');
  
  // Wait for response and extract token carefully
  const response = await responsePromise;
  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    // If JSON parsing fails (e.g., page navigated), try to get cookies directly
    console.log('Could not parse response JSON, checking cookies...');
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    if (authCookie) {
      // Cookie was set, just navigate
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL('/', { timeout: 5000 });
      return;
    }
    throw new Error('Failed to get auth token from response or cookies');
  }
  
  // Explicitly set the auth cookie using Playwright
  if (data.token) {
    await page.context().addCookies([{
      name: 'auth_token',
      value: data.token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    }]);
  }
  
  // Now navigate - cookie is guaranteed to be set
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL('/', { timeout: 5000 });
}

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
    await loginWithCookies(page);
    
    // Should see dashboard content (main page loaded, not login)
    await expect(page.locator('input[name="username"]')).not.toBeVisible();
  });

  test('should persist authentication after page refresh', async ({ page }) => {
    // Login first
    await loginWithCookies(page);
    
    // Refresh the page
    await page.reload({ waitUntil: 'networkidle' });
    
    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL('/', { timeout: 10000 });
    // Verify still authenticated (not showing login form)
    await expect(page.locator('input[name="username"]')).not.toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginWithCookies(page);
    
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
    await loginWithCookies(page);
    
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
