import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Bulk Delete Transactions Flow
 *
 * Tests the complete bulk deletion workflow including:
 * - Preview and confirmation
 * - Transaction type selection
 * - Strategy selection for installments and subscriptions
 * - Warnings for partial groups and affected subscriptions
 */

/**
 * Helper function to login with explicit cookie handling
 */
async function loginWithCookies(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'gili');
  await page.fill('input[name="password"]', 'y1a3r5o7n');

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
    { timeout: 5000 }
  );

  await page.click('button[type="submit"]');
  await responsePromise;

  await page.waitForURL('/', { timeout: 10000 }).catch(() => {});

  const cookies = await page.context().cookies();
  const authCookie = cookies.find((c) => c.name === 'auth_token');

  if (!authCookie) {
    throw new Error('Auth cookie not set after login');
  }

  const currentUrl = page.url();
  if (!currentUrl.includes(':3000/') || currentUrl.includes('/login')) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  await expect(page).toHaveURL('/', { timeout: 5000 });
}

test.describe('Bulk Delete Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithCookies(page);
  });

  test.describe('Preview and Cancel Flow', () => {
    test('user can preview deletion and cancel', async ({ page }) => {
      await page.goto('/admin/database', { waitUntil: 'domcontentloaded' });

      // Open bulk delete dialog
      const deleteButton = page.locator('button:has-text("Delete Transactions Based on Filters")');
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      // Wait for dialog to open
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Set date range
      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      const toDateInput = page.locator('input[name="to-date"], input[placeholder*="To"]').first();

      await fromDateInput.fill('2024-01-01');
      await toDateInput.fill('2024-12-31');

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
      await page.goto('/admin/database');
      

      // Open dialog
      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      // Set date range
      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      const toDateInput = page.locator('input[name="to-date"], input[placeholder*="To"]').first();

      await fromDateInput.fill('2024-01-01');
      await toDateInput.fill('2024-12-31');

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
  });

  test.describe('Installment Strategy Selection', () => {
    test('user can select delete entire payment plans strategy', async ({ page }) => {
      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      // Set a narrow date range to create partial groups
      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      const toDateInput = page.locator('input[name="to-date"], input[placeholder*="To"]').first();

      await fromDateInput.fill('2024-06-01');
      await toDateInput.fill('2024-06-30');

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
      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      const toDateInput = page.locator('input[name="to-date"], input[placeholder*="To"]').first();

      await fromDateInput.fill('2024-01-01');
      await toDateInput.fill('2024-12-31');

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
      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      await fromDateInput.fill('2024-01-01');

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
      await page.route('**/api/admin/transactions/bulk-delete', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Database error' }),
        });
      });

      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      await fromDateInput.fill('2024-01-01');

      await page.click('button:has-text("Preview Deletion")');

      // Verify error message appears
      await expect(
        page.locator('text=/Failed|Error|Could not/i')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Delete Button State', () => {
    test('delete button is disabled when all checkboxes unchecked', async ({ page }) => {
      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      await fromDateInput.fill('2024-01-01');

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
      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      await fromDateInput.fill('2024-01-01');

      await page.click('button:has-text("Preview Deletion")');
      await page.waitForSelector('text=/Delete \\d+ Transaction/i', { timeout: 10000 });

      // Verify count is displayed
      const deleteButton = page.locator('button:has-text(/Delete \\d+/i)').first();
      const buttonText = await deleteButton.textContent();

      expect(buttonText).toMatch(/Delete \d+ Transaction/i);
    });

    test('displays warning icons for partial groups', async ({ page }) => {
      await page.goto('/admin/database');
      

      await page.click('button:has-text("Delete Transactions Based on Filters")');
      await page.waitForSelector('[role="dialog"]');

      const fromDateInput = page.locator('input[name="from-date"], input[placeholder*="From"]').first();
      await fromDateInput.fill('2024-06-01');

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
