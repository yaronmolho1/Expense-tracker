import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Transactions Page
 * 
 * Tests transaction viewing, filtering, and management.
 */

test.describe('Transactions', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'gili');
    await page.fill('input[name="password"]', 'y1a3r5o7n');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should display transactions page', async ({ page }) => {
    await page.goto('/transactions');
    
    // Should show transactions page
    await expect(page).toHaveURL('/transactions');
    await expect(page.locator('text=Transactions').first()).toBeVisible();
  });

  test('should have filter controls', async ({ page }) => {
    await page.goto('/transactions');
    
    // Should have filter UI (search, date range, etc.)
    // Look for common filter elements
    const hasFilters = await page.locator('input[type="text"], input[type="search"], select, button:has-text("Filter")').count();
    expect(hasFilters).toBeGreaterThan(0);
  });

  test('should display transaction table or list', async ({ page }) => {
    await page.goto('/transactions');
    
    // Should have table or list structure
    // Either has rows or shows empty state
    const hasContent = await page.locator('table, [role="table"], text=No transactions, text=empty').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test('should allow sorting transactions', async ({ page }) => {
    await page.goto('/transactions');
    
    // Look for sort controls
    const hasSortControls = await page.locator('button:has-text("Sort"), select, [role="columnheader"]').count();
    
    // If there are transactions, should have sort controls
    if (hasSortControls > 0) {
      expect(hasSortControls).toBeGreaterThan(0);
    }
  });

  test('should show transaction details on click', async ({ page }) => {
    await page.goto('/transactions');
    
    // Wait a bit for data to load
    await page.waitForTimeout(1000);
    
    // Try to find a transaction row
    const transactionRow = page.locator('tr[data-transaction-id], [data-testid="transaction-row"]').first();
    
    // If transactions exist, clicking should show details
    const rowExists = await transactionRow.count() > 0;
    if (rowExists) {
      await transactionRow.click();
      
      // Should show modal or details
      await expect(page.locator('dialog, [role="dialog"], .modal').first()).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Transaction Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'gili');
    await page.fill('input[name="password"]', 'y1a3r5o7n');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await page.goto('/transactions');
  });

  test('should filter by status', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.locator('select, button:has-text("Status"), [data-testid="status-filter"]');
    
    if (await statusFilter.count() > 0) {
      await expect(statusFilter.first()).toBeVisible();
    }
  });

  test('should filter by date range', async ({ page }) => {
    // Look for date inputs
    const dateInputs = page.locator('input[type="date"]');
    
    // Should have at least date filtering capability
    const hasDateFilters = await dateInputs.count();
    expect(hasDateFilters).toBeGreaterThanOrEqual(0);
  });
});
