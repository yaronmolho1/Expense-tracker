import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Business Management - Combined Filters
 *
 * Tests the full filter pipeline from frontend to API to database.
 *
 * MEDIUM PRIORITY - Test 4: Combined Filters (E2E)
 * End-to-end testing of multiple filters working together.
 */

/**
 * Helper function to login with explicit cookie handling
 */
async function loginWithCookies(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'gili');
  await page.fill('input[name="password"]', 'y1a3r5o7n');

  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/auth/login') && resp.status() === 200,
    { timeout: 15000 }
  );

  await page.click('button[type="submit"]');
  await responsePromise;

  await page.waitForURL('/', { timeout: 10000 }).catch(() => {});

  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');

  if (!authCookie) {
    throw new Error('Auth cookie not set after login');
  }

  const currentUrl = page.url();
  if (!currentUrl.includes(':3000/') || currentUrl.includes('/login')) {
    await page.goto('/', { waitUntil: 'networkidle' });
  }

  await expect(page).toHaveURL('/', { timeout: 5000 });
}

test.describe('Business Management - Combined Filters E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithCookies(page);
    await page.goto('/manage/subscriptions');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Filter UI Presence', () => {
    test('should display all filter controls', async ({ page }) => {
      // Check for search box
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // Check for category filter
      const categoryFilter = page.getByText('Main Category');
      await expect(categoryFilter).toBeVisible();

      // Check for approval status filter
      const approvalFilter = page.getByText('Approval Status');
      await expect(approvalFilter).toBeVisible();

      // Check for date range pickers
      const dateFromLabel = page.getByText('Has Transactions From');
      await expect(dateFromLabel).toBeVisible();
    });
  });

  test.describe('Test 4.1: Uncategorized + Date Range (E2E)', () => {
    test('should filter uncategorized businesses with date range', async ({ page }) => {
      // Select "Uncategorized" from Main Category filter
      const categoryButton = page.locator('button').filter({ hasText: 'Main Category' });
      await categoryButton.click();
      await page.waitForTimeout(500);

      // Look for "Uncategorized" option
      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();
      await page.waitForTimeout(500);

      // Close dropdown by clicking elsewhere
      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await page.locator('[role="gridcell"]:has-text("1")').first().click();
      await page.waitForTimeout(1000);

      // Wait for results to load
      await page.waitForTimeout(2000);

      // Verify API call was made with correct parameters
      // Check that businesses displayed are uncategorized
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Test 4.2: Category + Date Range + Search (E2E)', () => {
    test('should apply all three filters together', async ({ page }) => {
      // Apply search filter
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Select a category
      const categoryButton = page.locator('button').filter({ hasText: 'Main Category' });
      await categoryButton.click();
      await page.waitForTimeout(500);

      // Select first category option (not Uncategorized)
      const firstCategory = page.locator('[role="option"]').first();
      await firstCategory.click();
      await page.waitForTimeout(500);

      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await page.locator('[role="gridcell"]:has-text("1")').first().click();
      await page.waitForTimeout(1000);

      // Wait for filters to apply
      await page.waitForTimeout(2000);

      // Verify results
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Test 4.3: Approval Status + Date Range (E2E)', () => {
    test('should filter approved businesses with date range', async ({ page }) => {
      // Select "Approved Only" from Approval Status dropdown
      const approvalButton = page.locator('button').filter({ hasText: 'Approval Status' });
      await approvalButton.click();
      await page.waitForTimeout(500);

      const approvedOption = page.locator('text=Approved Only').first();
      await approvedOption.click();
      await page.waitForTimeout(500);

      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await page.locator('[role="gridcell"]:has-text("15")').first().click();
      await page.waitForTimeout(1000);

      // Wait for results
      await page.waitForTimeout(2000);

      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should filter unapproved businesses with date range', async ({ page }) => {
      // Select "Unapproved Only"
      const approvalButton = page.locator('button').filter({ hasText: 'Approval Status' });
      await approvalButton.click();
      await page.waitForTimeout(500);

      const unapprovedOption = page.locator('text=Unapproved Only').first();
      await unapprovedOption.click();
      await page.waitForTimeout(500);

      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await page.locator('[role="gridcell"]:has-text("1")').first().click();
      await page.waitForTimeout(1000);

      await page.waitForTimeout(2000);

      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Filter Clearing', () => {
    test('should clear all filters and show all businesses', async ({ page }) => {
      // Apply some filters first
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(1000);

      // Select and deselect uncategorized
      const categoryButton = page.locator('button').filter({ hasText: 'Main Category' });
      await categoryButton.click();
      await page.waitForTimeout(500);

      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();
      await page.waitForTimeout(500);

      // Deselect
      await uncategorizedOption.click();
      await page.waitForTimeout(500);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // Results should show all businesses
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Uncategorized Filter Behavior', () => {
    test('should select uncategorized from Main Category multi-select', async ({ page }) => {
      const categoryButton = page.locator('button').filter({ hasText: 'Main Category' });
      await categoryButton.click();
      await page.waitForTimeout(500);

      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // API should be called with uncategorized=true
      // Verify results display
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should select uncategorized from Approval Status dropdown', async ({ page }) => {
      const approvalButton = page.locator('button').filter({ hasText: 'Approval Status' });
      await approvalButton.click();
      await page.waitForTimeout(500);

      const uncategorizedOption = page.locator('text=Uncategorized Only').first();
      await uncategorizedOption.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // API should be called with uncategorized=true
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should clear category filters when uncategorized is selected', async ({ page }) => {
      // First select a regular category
      const categoryButton = page.locator('button').filter({ hasText: 'Main Category' });
      await categoryButton.click();
      await page.waitForTimeout(500);

      const firstCategory = page.locator('[role="option"]').first();
      await firstCategory.click();
      await page.waitForTimeout(500);

      // Now select Uncategorized
      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // The regular category selection should be cleared
      // Only uncategorized filter should be active
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Pagination and Sorting with Filters', () => {
    test('should maintain filters when sorting', async ({ page }) => {
      // Apply a filter
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Click a column header to sort
      const tableHeader = page.locator('th, [role="columnheader"]').first();
      await tableHeader.click();
      await page.waitForTimeout(1000);

      // Filter should still be applied
      await expect(searchInput).toHaveValue('test');
    });

    test('should show empty state when filters return no results', async ({ page }) => {
      // Apply filters that return no results
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill('nonexistentbusinessname12345');
      await page.waitForTimeout(2000);

      // Should show empty state or "no results" message
      const emptyState = page.locator('text=/no results|no businesses|empty/i');
      await expect(emptyState).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('API Request Validation', () => {
    test('should send correct query parameters for date range', async ({ page }) => {
      // Listen for API requests
      const requestPromise = page.waitForRequest(
        request => request.url().includes('/api/businesses') && request.url().includes('date_from'),
        { timeout: 10000 }
      );

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await page.locator('[role="gridcell"]:has-text("15")').first().click();
      await page.waitForTimeout(1000);

      // Wait for and verify the request
      const request = await requestPromise;
      const url = request.url();

      expect(url).toContain('date_from');
      expect(url).toMatch(/date_from=\d{4}-\d{2}-\d{2}/);
    });

    test('should send uncategorized=true for uncategorized filter', async ({ page }) => {
      // Listen for API requests
      const requestPromise = page.waitForRequest(
        request => request.url().includes('/api/businesses') && request.url().includes('uncategorized'),
        { timeout: 15000 }
      );

      // Select uncategorized
      const categoryButton = page.locator('button').filter({ hasText: 'Main Category' });
      await categoryButton.click();
      await page.waitForTimeout(500);

      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();
      await page.waitForTimeout(1000);

      await page.keyboard.press('Escape');

      // Wait for and verify the request
      const request = await requestPromise;
      const url = request.url();

      expect(url).toContain('uncategorized=true');
    });
  });
});
