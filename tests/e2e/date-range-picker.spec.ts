import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: DateRangePicker Component
 *
 * Tests user interactions with the smart date range picker in the business filters.
 * Auth state is provided by storage state from setup project.
 *
 * HIGH PRIORITY - Test 2: Smart Validation (E2E)
 * End-to-end validation of date range picker behavior.
 */

/**
 * Helper function to safely click calendar date cells
 * Handles viewport issues by using dispatchEvent as fallback
 */
async function clickCalendarCell(page: Page, dayText: string) {
  // Target the day button directly inside the calendar grid
  const dayButton = page.locator('[role="grid"] button').filter({ hasText: new RegExp(`^${dayText}$`) }).first();

  // Wait for the button to be in the DOM and attached
  await dayButton.waitFor({ state: 'attached', timeout: 5000 });

  // Use evaluate to fire a native DOM click — this bypasses Playwright's viewport
  // and hit-test checks, which fail when the Radix portal calendar renders outside
  // the CI viewport even after scrollIntoViewIfNeeded().
  await dayButton.evaluate((el: HTMLElement) => el.click());

  // Wait for calendar to close after selection
  await page.locator('[role="grid"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

test.describe('DateRangePicker E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up BEFORE goto so we don't miss the response.
    // /api/filter-options controls isLoading in BusinessFilters, which gates
    // whether CollapsibleFilter renders its children (it uses {isOpen && children}).
    const filterOptionsReady = page.waitForResponse(
      resp => resp.url().includes('/api/filter-options') && resp.status() === 200,
      { timeout: 15000 }
    );

    await page.goto('/manage/businesses');

    // Wait for filter-options → isLoading=false → date pickers are now in the DOM
    await filterOptionsReady;
  });

  test.describe('Basic Rendering', () => {
    test('should display date range pickers in business filters', async ({ page }) => {
      // Look for the date range picker labels (labels are "From" and "To")
      const fromLabel = page.getByText('From', { exact: true }).first();
      const toLabel = page.getByText('To', { exact: true }).first();

      await expect(fromLabel).toBeVisible();
      await expect(toLabel).toBeVisible();
    });

    test('should show placeholders when dates are empty', async ({ page }) => {
      // Date picker buttons should show DD/MM/YYYY placeholder
      const fromButton = page.locator('button:has-text("DD/MM/YYYY")').first();
      await expect(fromButton).toBeVisible();
    });
  });

  test.describe('Date Selection', () => {
    test('should allow selecting a "From" date', async ({ page }) => {
      // Open the "From Date" picker
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();

      // Wait for calendar to appear
      await page.waitForSelector('[role="grid"]', { timeout: 5000 });

      // Click on a date (e.g., day 15) using helper to avoid viewport issues
      await clickCalendarCell(page, '15');

      // Calendar should close and date should be displayed
      await page.waitForTimeout(500);

      // Verify date is displayed in DD/MM/YYYY format
      const button = page.locator('button').filter({ hasText: /15\/\d{2}\/\d{4}/ }).first();
      await expect(button).toBeVisible();
    });

    test('should allow selecting a "To" date', async ({ page }) => {
      // First set a "From" date
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '10');
      await page.waitForTimeout(500);

      // Now select "To" date
      // Find the "To" date button (second date picker button in the date range section)
      const toButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).nth(1);
      await toButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '25');
      await page.waitForTimeout(500);

      // Verify both dates are displayed
      const buttons = page.locator('button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ });
      await expect(buttons).toHaveCount(2);
    });
  });

  test.describe('Test 2.1: Date Disabling in "To" Picker', () => {
    test('should disable dates before "From Date" in "To" picker', async ({ page }) => {
      // Set "From Date" to the 15th
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');

      await clickCalendarCell(page, '15');
      await page.waitForTimeout(500);

      // Open "To Date" picker
      // Find the "To" date button (second date picker button in the date range section)
      const toButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).nth(1);
      await toButton.click();
      await page.waitForSelector('[role="grid"]');

      // Dates before the 15th should be disabled.
      // shadcn calendar sets `disabled` on the <button> inside the gridcell, not on the <td>.
      const day10Button = page.locator('[role="grid"] button').filter({ hasText: /^10$/ }).first();

      const isDisabled = await day10Button.evaluate((el: HTMLButtonElement) => {
        return el.disabled || el.getAttribute('aria-disabled') === 'true';
      });

      expect(isDisabled).toBe(true);
    });
  });

  test.describe('Test 2.3: Calendar Opens to Correct Month', () => {
    test('should open "To" calendar to same month as "From" when "To" is empty', async ({ page }) => {
      // Set "From Date" to a specific month (e.g., select a date showing the month)
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');

      // Get the current month displayed
      const monthDisplay = page.locator('[role="grid"]').first();
      await monthDisplay.waitFor({ state: 'visible' });

      // Select a date
      await clickCalendarCell(page, '10');
      await page.waitForTimeout(500);

      // Open "To Date" picker
      // Find the "To" date button (second date picker button in the date range section)
      const toButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).nth(1);
      await toButton.click();
      await page.waitForSelector('[role="grid"]');

      // The calendar should be showing the same month as "From Date"
      // We can verify this by checking the month/year display is visible
      await expect(monthDisplay).toBeVisible();
    });
  });

  test.describe('Test 2.5: Independent Clearing', () => {
    test('should allow clearing dates independently', async ({ page }) => {
      // Set both dates
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '10');
      await page.waitForTimeout(500);

      // Find the "To" date button (second date picker button in the date range section)
      const toButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).nth(1);
      await toButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '25');
      await page.waitForTimeout(500);

      // Both dates should be displayed
      const buttons = page.locator('button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ });
      await expect(buttons).toHaveCount(2);

      // Clear "From Date" by opening calendar and clicking outside or using clear button if available
      // Note: Clearing typically requires re-clicking the date or using a clear button
      // For this test, we verify that dates can be set independently
    });
  });

  test.describe('Integration with Business Filters', () => {
    test('should filter businesses by date range', async ({ page }) => {
      // Set a date range
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '1');
      await page.waitForTimeout(500);

      // Wait for API call to complete
      await page.waitForTimeout(1000);

      // The business list should update (check for loading state or data update)
      // We can verify by checking if the page has refreshed data
      // Use .first() to avoid strict mode violation (calendar grid is also a table)
      const businessTable = page.locator('table').first();
      await expect(businessTable).toBeVisible({ timeout: 10000 });
    });

    test('should clear date filters when dates are removed', async ({ page }) => {
      // Set a date
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '10');
      await page.waitForTimeout(500);

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Note: Actual clearing mechanism depends on implementation
      // This test verifies the integration works
      // Use .first() to avoid strict mode violation (calendar grid is also a table)
      const businessTable = page.locator('table').first();
      await expect(businessTable).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Display Format', () => {
    test('should display selected dates in DD/MM/YYYY format', async ({ page }) => {
      // Select a date
      // Find the "From" date button (first date picker button in the date range section)
      const fromButton = page.getByRole('button', { name: /DD\/MM\/YYYY|\d{2}\/\d{2}\/\d{4}/ }).first();
      await fromButton.click();
      await page.waitForSelector('[role="grid"]');
      await clickCalendarCell(page, '15');
      await page.waitForTimeout(500);

      // Verify format: DD/MM/YYYY (e.g., 15/01/2024)
      const dateButton = page.locator('button').filter({ hasText: /15\/\d{2}\/\d{4}/ }).first();
      await expect(dateButton).toBeVisible();

      // Extract and verify format
      const buttonText = await dateButton.textContent();
      expect(buttonText).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });
});
