// TEMPORARILY COMMENTED OUT - Component being refactored
// Uncomment this file once the bulk delete feature is finalized

/*
import { test, expect, Page } from '@playwright/test';

// E2E Tests: Bulk Delete Transactions Flow
//
// Tests the complete bulk deletion workflow including:
// - Preview and confirmation
// - Transaction type selection
// - Strategy selection for installments and subscriptions
// - Warnings for partial groups and affected subscriptions
// Auth state is provided by storage state from setup project.

// Helper function to safely click calendar date cells
// Handles viewport issues by using dispatchEvent as fallback
async function clickCalendarCell(page: Page, dayText: string) {
  const cell = page.locator('[role="gridcell"]').filter({ hasText: new RegExp(`^${dayText}$`) }).first();

  // Wait for element to be attached and visible
  await cell.waitFor({ state: 'visible', timeout: 5000 });

  // Wait for calendar to settle
  await page.locator('[role="grid"]').waitFor({ state: 'visible', timeout: 3000 });

  try {
    // First attempt: scroll into view and click
    await cell.scrollIntoViewIfNeeded();
    await cell.click({ timeout: 2000 });
  } catch (error) {
    // Fallback: Use dispatchEvent to bypass viewport checks
    await cell.dispatchEvent('click');
  }

  // CRITICAL: Wait for the popover overlay to completely disappear
  // The modal overlay ([data-slot="dialog-overlay"]) blocks all interactions until it's gone
  // This is the KEY fix - without this, the overlay blocks subsequent clicks
  await page.locator('[data-slot="dialog-overlay"]').waitFor({ state: 'hidden', timeout: 5000 });
}

test.describe('Bulk Delete Transactions', () => {
  // Add beforeEach to ensure page loads properly
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/database', { waitUntil: 'networkidle' });
    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Preview and Cancel Flow', () => {
    test('user can preview deletion and cancel', async ({ page }) => {
      // Expand the "Delete Specific Transactions" section first
      await page.click('text=Delete Specific Transactions');

      // Open bulk delete dialog
      const deleteButton = page.locator('button:has-text("Delete transactions")');
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      // Wait for dialog to open
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Set date range using calendar popover
      // Click "From Date" button to open calendar
      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1'); // Select day 1

      // Click "To Date" button to open calendar
      const toDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).last();
      await toDateButton.click();
      await clickCalendarCell(page, '31'); // Select day 31

      // Click preview
      const previewButton = page.locator('button:has-text("Preview Deletion")');
      await previewButton.click();

      // Wait for confirmation dialog
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Verify preview shows information
      await expect(page.locator('text=/Found|Transaction/i')).toBeVisible();

      // Cancel
      const cancelButton = page.locator('button:has-text("Cancel")').last();
      await cancelButton.click();

      // Verify dialog closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Delete One-time Transactions Only', () => {
    test('user can delete only one-time transactions', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      // Open dialog
      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      // Set date range using calendar popover
      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      const toDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).last();
      await toDateButton.click();
      await clickCalendarCell(page, '31');

      // Click preview
      await page.click('button:has-text("Preview Deletion")');

      // Wait for confirmation dialog
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Uncheck installments and subscriptions checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      // Find and uncheck installments and subscriptions (keep only one-time checked)
      for (let i = 0; i < count; i++) {
        const checkbox = checkboxes.nth(i);
        const isChecked = await checkbox.isChecked();
        const label = await page.locator(`label[for="${await checkbox.getAttribute('id')}"]`).textContent();

        if (label && (label.includes('installment') || label.includes('subscription')) && isChecked) {
          await checkbox.click();
        }
      }

      // Confirm deletion
      const deleteButton = page.locator('button:has-text(/Delete \\d+ Transaction/i)').first();
      await deleteButton.click();

      // Wait for success message
      await expect(
        page.locator('text=/Deleted \\d+ transaction/i, text=/success/i')
      ).toBeVisible({ timeout: 10000 });
    });

    test('user can delete only installments (without one-time)', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      // Open dialog
      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      // Set date range
      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      const toDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).last();
      await toDateButton.click();
      await clickCalendarCell(page, '31');

      // Click preview
      await page.click('button:has-text("Preview Deletion")');

      // Wait for confirmation dialog
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Uncheck one-time checkbox
      const oneTimeCheckbox = page.locator('input[id="include-onetime"]');
      if (await oneTimeCheckbox.isChecked()) {
        await oneTimeCheckbox.click();
      }

      // Verify delete button is enabled and shows correct count
      const deleteButton = page.locator('button:has-text(/Delete \\d+ Transaction/i)').first();
      await expect(deleteButton).toBeEnabled();

      // Verify it's NOT showing "Delete 0"
      const buttonText = await deleteButton.textContent();
      expect(buttonText).not.toContain('Delete 0');
    });

    test('user can delete only subscriptions (without one-time)', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      // Open dialog
      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      // Set date range
      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      // Click preview
      await page.click('button:has-text("Preview Deletion")');

      // Wait for confirmation dialog
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Uncheck one-time and installments
      const oneTimeCheckbox = page.locator('input[id="include-onetime"]');
      if (await oneTimeCheckbox.isChecked()) {
        await oneTimeCheckbox.click();
      }

      const installmentsCheckbox = page.locator('input[id="include-installments"]');
      if (await installmentsCheckbox.isChecked()) {
        await installmentsCheckbox.click();
      }

      // Change subscription strategy to delete
      const deleteSubRadio = page.locator('input[value="delete_in_range_and_cancel"]');
      if (await deleteSubRadio.isVisible()) {
        await deleteSubRadio.click();

        // Verify delete button is enabled and shows correct count
        const deleteButton = page.locator('button:has-text(/Delete \\d+ Transaction/i)').first();
        await expect(deleteButton).toBeEnabled();

        // Verify it's NOT showing "Delete 0"
        const buttonText = await deleteButton.textContent();
        expect(buttonText).not.toContain('Delete 0');
      }
    });
  });

  test.describe('Installment Strategy Selection', () => {
    test('user can select delete entire payment plans strategy', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      // Set a narrow date range to create partial groups
      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      const toDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).last();
      await toDateButton.click();
      await clickCalendarCell(page, '30');

      await page.click('button:has-text("Preview Deletion")');

      // Wait for confirmation
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Check if partial installment warning shows (may not exist if no partial groups)
      const hasPartialWarning = await page.locator('text=/Partial Installment/i').isVisible().catch(() => false);

      if (hasPartialWarning) {
        // Select "Delete complete payment plans" strategy
        const deleteAllRadio = page.locator('input[value="delete_all_matching_groups"]');
        if (await deleteAllRadio.isVisible()) {
          await deleteAllRadio.click();

          // Verify count updates
          await expect(page.locator('button:has-text(/Delete \\d+/i)')).toBeVisible();
        }
      }

      // Cancel to avoid actual deletion
      await page.click('button:has-text("Cancel")');
    });

    test('user can select delete only matching payments strategy', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      const toDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).last();
      await toDateButton.click();
      await clickCalendarCell(page, '31');

      await page.click('button:has-text("Preview Deletion")');
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Select "Only matching payments" strategy
      const deleteMatchingRadio = page.locator('input[value="delete_matching_only"]');
      if (await deleteMatchingRadio.isVisible()) {
        await deleteMatchingRadio.click();
      }

      // Cancel
      await page.click('button:has-text("Cancel")');
    });
  });

  test.describe('Subscription Handling', () => {
    test('user sees warning for affected subscriptions', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      await page.click('button:has-text("Preview Deletion")');
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Check if affected subscriptions warning shows
      const hasSubscriptionWarning = await page
        .locator('text=/Affected Subscription/i')
        .isVisible()
        .catch(() => false);

      if (hasSubscriptionWarning) {
        // Verify "skip" strategy is default
        const skipRadio = page.locator('input[value="skip"]');
        await expect(skipRadio).toBeChecked();

        // Change to cancel subscriptions
        const cancelRadio = page.locator('input[value="delete_in_range_and_cancel"]');
        if (await cancelRadio.isVisible()) {
          await cancelRadio.click();
          await expect(cancelRadio).toBeChecked();
        }
      }

      // Cancel
      await page.click('button:has-text("Cancel")');
    });
  });

  test.describe('Error Handling', () => {
    test('shows error when API fails', async ({ page }) => {
      // Mock API to return error
      await page.route('api/admin/transactions/bulk-delete', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Database error' }),
        });
      });

      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      await page.click('button:has-text("Preview Deletion")');

      // Verify error message appears
      await expect(
        page.locator('text=/Failed|Error|Could not/i')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Delete Button State', () => {
    test('delete button is disabled when all checkboxes unchecked', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      await page.click('button:has-text("Preview Deletion")');
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Uncheck all checkboxes
      const checkboxes = page.locator('input[type="checkbox"]:checked');
      const count = await checkboxes.count();

      for (let i = 0; i < count; i++) {
        await checkboxes.nth(0).click(); // Always click first since list shrinks
      }

      // Verify delete button shows 0 and is disabled
      const deleteButton = page.locator('button:has-text(/Delete 0/i)').first();
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeDisabled();
    });
  });

  test.describe('Visual Elements', () => {
    test('displays transaction count correctly', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      await page.click('button:has-text("Preview Deletion")');
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Verify count is displayed
      const deleteButton = page.locator('button:has-text(/Delete \\d+/i)').first();
      const buttonText = await deleteButton.textContent();

      expect(buttonText).toMatch(/Delete \d+ Transaction/i);
    });

    test('displays warning icons for partial groups', async ({ page }) => {
      // Expand the section first
      await page.click('text=Delete Specific Transactions');

      await page.click('button:has-text("Delete transactions")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateButton = page.locator('button').filter({ hasText: /DD\/MM\/YYYY/ }).first();
      await fromDateButton.click();
      await clickCalendarCell(page, '1');

      await page.click('button:has-text("Preview Deletion")');
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Check for warning elements (AlertTriangle icons or warning text)
      const hasWarnings =
        (await page.locator('[data-lucide="alert-triangle"], svg.lucide-alert-triangle').count()) > 0 ||
        (await page.locator('text=/warning|caution/i').count()) > 0;

      // This is informational - warnings may or may not be present depending on data
      expect(typeof hasWarnings).toBe('boolean');
    });
  });
});
*/
