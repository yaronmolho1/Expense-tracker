import { test as setup, expect } from '@playwright/test';

/**
 * Authentication Setup for E2E Tests
 * 
 * This runs once before all tests and saves the authenticated state.
 * Other tests can reuse this state instead of logging in repeatedly.
 */

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login', { waitUntil: 'networkidle' });
  
  // Fill in credentials
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'gili');
  await page.fill('input[name="password"]', 'y1a3r5o7n');
  
  // Wait for login response
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/auth/login') && resp.status() === 200,
    { timeout: 15000 }
  );
  
  // Click submit
  await page.click('button[type="submit"]');
  
  // Wait for successful login
  await responsePromise;
  
  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10000 }).catch(() => {});
  
  // Verify we have auth cookie
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  expect(authCookie).toBeTruthy();
  
  // Save signed-in state to 'storageState'
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Authentication state saved to', authFile);
});
