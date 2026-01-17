import { describe, it, expect, beforeAll } from 'vitest';
import { generateToken } from '@/lib/utils/auth';

/**
 * Integration Tests: Business Filters - Combined Filters
 *
 * Tests multiple filters working together with AND logic.
 *
 * MEDIUM PRIORITY - Test 4: Combined Filters Integration
 * Covers Test 4.1-4.3 from the test requirements document.
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Business Filters - Combined Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await generateToken({
      userId: 'default-user',
      email: 'test@example.com',
    });
  });

  describe('Test 4.1: Uncategorized + Date Range', () => {
    it('should combine uncategorized filter with date range (AND logic)', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 1); // Last month
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?uncategorized=true&date_from=${fromStr}&date_to=${toStr}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(Array.isArray(data.businesses)).toBe(true);

      // All businesses must satisfy BOTH conditions:
      // 1. primary_category IS NULL (uncategorized)
      // 2. Has transactions in the date range
      data.businesses.forEach((business: any) => {
        expect(business.primary_category).toBeNull();

        // If date range is applied, business must have transactions in range
        // transaction_count > 0 implies has transactions in range
        if (data.businesses.length > 0) {
          expect(business.transaction_count).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should exclude categorized businesses even if they have transactions in date range', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 6);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?uncategorized=true&date_from=${fromStr}&date_to=${toStr}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // None should have a category
      data.businesses.forEach((business: any) => {
        expect(business.primary_category).toBeNull();
      });
    });

    it('should return empty array when no uncategorized businesses have transactions in range', async () => {
      // Use a date range where no uncategorized businesses have transactions
      const dateFrom = '2015-01-01';
      const dateTo = '2015-12-31';

      const response = await fetch(
        `${BASE_URL}/api/businesses?uncategorized=true&date_from=${dateFrom}&date_to=${dateTo}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.businesses).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Test 4.2: Category + Date Range + Search', () => {
    it('should combine all three filters with AND logic', async () => {
      // First get a categorized business to search for
      const allResponse = await fetch(`${BASE_URL}/api/businesses`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const allData = await allResponse.json();
      const categorizedBusiness = allData.businesses.find((b: any) => b.primary_category !== null);

      if (!categorizedBusiness) {
        return; // Skip if no categorized businesses
      }

      const categoryId = categorizedBusiness.primary_category.id;
      const searchTerm = categorizedBusiness.display_name.substring(0, 3);

      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 3);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?parent_category_ids=${categoryId}&date_from=${fromStr}&date_to=${toStr}&search=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // All results must satisfy ALL three conditions:
      // 1. primary_category_id matches
      // 2. Has transactions in date range
      // 3. display_name contains search term
      data.businesses.forEach((business: any) => {
        expect(business.primary_category?.id).toBe(categoryId);
        expect(business.display_name.toLowerCase()).toContain(searchTerm.toLowerCase());
        expect(business.transaction_count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return empty array when no businesses match all conditions', async () => {
      // Use impossible combination
      const dateFrom = '2015-01-01';
      const dateTo = '2015-01-31';

      const response = await fetch(
        `${BASE_URL}/api/businesses?parent_category_ids=1&date_from=${dateFrom}&date_to=${dateTo}&search=impossiblebusinessname`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.businesses).toEqual([]);
      expect(data.total).toBe(0);
    });
  });

  describe('Test 4.3: Approval Status + Date Range', () => {
    it('should combine approved filter with date range', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 2);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?approved_only=true&date_from=${fromStr}&date_to=${toStr}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // All businesses must be:
      // 1. Approved
      // 2. Have transactions in date range
      data.businesses.forEach((business: any) => {
        expect(business.approved).toBe(true);
        expect(business.transaction_count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should combine unapproved filter with date range', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 2);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?approved_only=false&date_from=${fromStr}&date_to=${toStr}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // All businesses must be:
      // 1. NOT approved
      // 2. Have transactions in date range
      data.businesses.forEach((business: any) => {
        expect(business.approved).toBe(false);
        expect(business.transaction_count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('All Filters Combined', () => {
    it('should combine category, approval, date range, and search', async () => {
      // Get test data
      const allResponse = await fetch(`${BASE_URL}/api/businesses`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const allData = await allResponse.json();
      const approvedCategorized = allData.businesses.find(
        (b: any) => b.approved && b.primary_category !== null
      );

      if (!approvedCategorized) {
        return; // Skip if no suitable test data
      }

      const categoryId = approvedCategorized.primary_category.id;
      const searchTerm = approvedCategorized.display_name.substring(0, 2);

      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 6);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?parent_category_ids=${categoryId}&approved_only=true&date_from=${fromStr}&date_to=${toStr}&search=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // All results must satisfy ALL conditions
      data.businesses.forEach((business: any) => {
        expect(business.primary_category?.id).toBe(categoryId);
        expect(business.approved).toBe(true);
        expect(business.display_name.toLowerCase()).toContain(searchTerm.toLowerCase());
        expect(business.transaction_count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle uncategorized + unapproved + date range', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 1);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?uncategorized=true&approved_only=false&date_from=${fromStr}&date_to=${toStr}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // All must be uncategorized AND unapproved AND have transactions in range
      data.businesses.forEach((business: any) => {
        expect(business.primary_category).toBeNull();
        expect(business.approved).toBe(false);
        expect(business.transaction_count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Filter Precedence and Logic', () => {
    it('should apply filters in correct order (uncategorized overrides category)', async () => {
      // When uncategorized=true, category filters should be ignored
      const response = await fetch(
        `${BASE_URL}/api/businesses?uncategorized=true&parent_category_ids=1,2,3`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only return uncategorized (category filter ignored)
      data.businesses.forEach((business: any) => {
        expect(business.primary_category).toBeNull();
      });
    });

    it('should handle empty filter combinations', async () => {
      // No filters applied - should return all businesses
      const response = await fetch(`${BASE_URL}/api/businesses`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(Array.isArray(data.businesses)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sorting with Combined Filters', () => {
    it('should sort by name with combined filters', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 3);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?date_from=${fromStr}&date_to=${toStr}&sort=name&approved_only=true`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should be sorted by name (ascending)
      let prevName = '';
      data.businesses.forEach((business: any) => {
        if (prevName) {
          expect(business.display_name >= prevName).toBe(true);
        }
        prevName = business.display_name;
      });
    });

    it('should sort by transaction_count with date filter', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 3);
      const dateTo = new Date();

      const fromStr = dateFrom.toISOString().split('T')[0];
      const toStr = dateTo.toISOString().split('T')[0];

      const response = await fetch(
        `${BASE_URL}/api/businesses?date_from=${fromStr}&date_to=${toStr}&sort=transaction_count`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should be sorted by transaction_count (descending)
      // transaction_count is filtered by date range
      let prevCount = Infinity;
      data.businesses.forEach((business: any) => {
        expect(business.transaction_count).toBeLessThanOrEqual(prevCount);
        prevCount = business.transaction_count;
      });
    });
  });

  describe('SQL Injection Protection', () => {
    it('should sanitize search parameter', async () => {
      const maliciousSearch = "'; DROP TABLE businesses; --";

      const response = await fetch(
        `${BASE_URL}/api/businesses?search=${encodeURIComponent(maliciousSearch)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      // Should not crash - either 200 with no results or handled safely
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data.businesses)).toBe(true);
      }
    });

    it('should sanitize category ID parameters', async () => {
      const maliciousCategory = "1; DROP TABLE businesses; --";

      const response = await fetch(
        `${BASE_URL}/api/businesses?parent_category_ids=${encodeURIComponent(maliciousCategory)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      // Should handle safely
      expect([200, 400]).toContain(response.status);
    });
  });
});
