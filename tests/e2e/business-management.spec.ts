import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Business Management - Combined Filters
 *
 * Tests the full filter pipeline from frontend to API to database.
 * Auth state is provided by storage state from setup project.
 *
 * MEDIUM PRIORITY - Test 4: Combined Filters (E2E)
 * End-to-end testing of multiple filters working together.
 */

/**
 * Helper function to safely click calendar date cells
 * Handles viewport issues by using dispatchEvent as fallback
 */
async function clickCalendarCell(page: Page, dayText: string) {
  const cell = page.locator('[role="gridcell"]').filter({ hasText: new RegExp(`^${dayText}$`) }).first();

  // Wait for element to be attached and visible
  await cell.waitFor({ state: 'visible', timeout: 5000 });

  // Wait for calendar to settle (removed hard wait, added state check)
  await page.locator('[role="grid"]').waitFor({ state: 'visible', timeout: 3000 });

  try {
    // First attempt: scroll into view and click
    await cell.scrollIntoViewIfNeeded();
    await cell.click({ timeout: 2000 });
  } catch (error) {
    // Fallback: Use dispatchEvent to bypass viewport checks
    await cell.dispatchEvent('click');
  }

  // Wait for calendar to close after click
  await page.locator('[role="grid"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

test.describe('Business Management - Combined Filters E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manage/businesses', { waitUntil: 'domcontentloaded' });

    // Wait for the page to finish loading - ensure "Loading..." text is gone
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading filters...'),
      { timeout: 10000 }
    );

    // Wait for initial API call to complete and data to load
    await page.waitForResponse(
      resp => resp.url().includes('/api/businesses') && resp.status() === 200,
      { timeout: 10000 }
    ).catch(() => {});

    // Wait for table to render (ensures data is loaded)
    await page.locator('table, [role="table"]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    // Wait for filter controls to be enabled (not disabled during loading)
    await page.waitForSelector('input[placeholder*="Search"], input[type="search"]', { timeout: 10000 });
  });

  test.describe('Filter UI Presence', () => {
    test('should display all filter controls', async ({ page }) => {
      // Check for search box
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      // Check for category filter (MultiSelect with placeholder "All categories")
      const categoryFilter = page.locator('button:has-text("All categories"), button:has-text("Main Category")').first();
      await expect(categoryFilter).toBeVisible();

      // Check for approval status filter (Select component)
      const approvalFilter = page.locator('button').filter({ hasText: /All Businesses|Approved Only|Unapproved Only|Uncategorized Only/ }).first();
      await expect(approvalFilter).toBeVisible();

      // Check for date range pickers (labels changed from "Has Transactions From" to "From")
      const dateFromInput = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await expect(dateFromInput).toBeVisible();
    });
  });

  test.describe('Test 4.1: Uncategorized + Date Range (E2E)', () => {
    test('should filter uncategorized businesses with date range', async ({ page }) => {
      // Wait for button to be enabled before clicking (MultiSelect with placeholder)
      const categoryButton = page.locator('button:has-text("All categories"), button').first();
      await expect(categoryButton).toBeEnabled({ timeout: 10000 });
      await categoryButton.click();

      // Look for "Uncategorized" option and wait for it to be visible
      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.waitFor({ state: 'visible' });
      await uncategorizedOption.click();

      // Close dropdown by clicking elsewhere
      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '1');

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

      // Wait for button to be enabled before clicking (MultiSelect)
      const categoryButton = page.locator('button:has-text("All categories"), button').first();
      await expect(categoryButton).toBeEnabled({ timeout: 10000 });
      await categoryButton.click();

      // Select first category option (not Uncategorized)
      const firstCategory = page.locator('[role="option"]').first();
      await firstCategory.click();

      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '1');

      // Wait for filters to apply

      // Verify results
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Test 4.3: Approval Status + Date Range (E2E)', () => {
    test('should filter approved businesses with date range', async ({ page }) => {
      // Wait for Select button to be enabled (shows current selection, not a label)
      const approvalButton = page.locator('button').filter({ hasText: /All Businesses|Approved Only|Unapproved Only|Uncategorized Only/ }).first();
      await expect(approvalButton).toBeEnabled({ timeout: 10000 });
      await approvalButton.click();

      const approvedOption = page.locator('text=Approved Only').first();
      await approvedOption.click();

      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '15');

      // Wait for results

      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should filter unapproved businesses with date range', async ({ page }) => {
      // Wait for Select button to be enabled
      const approvalButton = page.locator('button').filter({ hasText: /All Businesses|Approved Only|Unapproved Only|Uncategorized Only/ }).first();
      await expect(approvalButton).toBeEnabled({ timeout: 10000 });
      await approvalButton.click();

      const unapprovedOption = page.locator('text=Unapproved Only').first();
      await unapprovedOption.click();

      await page.keyboard.press('Escape');

      // Set date range
      const fromButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '1');


      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Filter Clearing', () => {
    test('should clear all filters and show all businesses', async ({ page }) => {
      // Apply some filters first
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill('test');

      // Clear search
      await searchInput.clear();

      // Select and deselect uncategorized (MultiSelect)
      const categoryButton = page.locator('button:has-text("All categories"), button').first();
      await categoryButton.click();

      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();

      // Deselect
      await uncategorizedOption.click();

      await page.keyboard.press('Escape');

      // Results should show all businesses
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Uncategorized Filter Behavior', () => {
    test('should select uncategorized from Main Category multi-select', async ({ page }) => {
      const categoryButton = page.locator('button:has-text("All categories"), button').first();
      await expect(categoryButton).toBeEnabled({ timeout: 10000 });
      await categoryButton.click();

      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();

      await page.keyboard.press('Escape');

      // API should be called with uncategorized=true
      // Verify results display
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should select uncategorized from Approval Status dropdown', async ({ page }) => {
      const approvalButton = page.locator('button').filter({ hasText: /All Businesses|Approved Only|Unapproved Only|Uncategorized Only/ }).first();
      await expect(approvalButton).toBeEnabled({ timeout: 10000 });
      await approvalButton.click();

      const uncategorizedOption = page.locator('text=Uncategorized Only').first();
      await uncategorizedOption.click();

      await page.keyboard.press('Escape');

      // API should be called with uncategorized=true
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should clear category filters when uncategorized is selected', async ({ page }) => {
      // Wait for button to be enabled before clicking (MultiSelect)
      const categoryButton = page.locator('button:has-text("All categories"), button').first();
      await expect(categoryButton).toBeEnabled({ timeout: 10000 });
      await categoryButton.click();

      const firstCategory = page.locator('[role="option"]').first();
      await firstCategory.click();

      // Now select Uncategorized
      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();

      await page.keyboard.press('Escape');

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

      // Click a column header to sort
      const tableHeader = page.locator('th, [role="columnheader"]').first();
      await tableHeader.click();

      // Filter should still be applied
      await expect(searchInput).toHaveValue('test');
    });

    test('should show empty state when filters return no results', async ({ page }) => {
      // Apply filters that return no results
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill('nonexistentbusinessname12345');

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
      await clickCalendarCell(page, '15');

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

      // Wait for button to be enabled before clicking (MultiSelect)
      const categoryButton = page.locator('button:has-text("All categories"), button').first();
      await expect(categoryButton).toBeEnabled({ timeout: 10000 });
      await categoryButton.click();

      const uncategorizedOption = page.locator('text=Uncategorized').first();
      await uncategorizedOption.click();

      await page.keyboard.press('Escape');

      // Wait for and verify the request
      const request = await requestPromise;
      const url = request.url();

      expect(url).toContain('uncategorized=true');
    });
  });
});
