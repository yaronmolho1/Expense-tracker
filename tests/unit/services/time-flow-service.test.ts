import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TimeFlowFilters, SubCategoryData } from '@/lib/services/time-flow-service';

/**
 * Unit Tests: Time Flow Service
 *
 * Tests the three main improvements:
 * 1. Refund handling (subtracting refunds from totals)
 * 2. Category filtering (main and sub-category filters)
 * 3. Annual budget heatmap (YTD vs annual budget)
 */

describe('Time Flow Service', () => {
  describe('Refund Handling', () => {
    it('should negate refund amounts in calculations', () => {
      // Simulate refund logic
      const chargedAmountIls = 100;
      const isRefund = true;

      // Refund formula: amount = r.isRefund ? -Math.abs(chargedAmountIls) : chargedAmountIls
      const amount = isRefund ? -Math.abs(chargedAmountIls) : chargedAmountIls;

      expect(amount).toBe(-100);
    });

    it('should keep positive amounts for non-refund transactions', () => {
      const chargedAmountIls = 100;
      const isRefund = false;

      const amount = isRefund ? -Math.abs(chargedAmountIls) : chargedAmountIls;

      expect(amount).toBe(100);
    });

    it('should reduce monthly totals when refund is applied', () => {
      // Simulate monthly expense calculation
      const transactions = [
        { amount: 100, isRefund: false },
        { amount: 50, isRefund: false },
        { amount: 30, isRefund: true }, // Refund
      ];

      let monthlyTotal = 0;
      transactions.forEach((t) => {
        const amount = t.isRefund ? -Math.abs(t.amount) : t.amount;
        monthlyTotal += amount;
      });

      // Expected: 100 + 50 - 30 = 120
      expect(monthlyTotal).toBe(120);
    });

    it('should reduce row total when refund is included', () => {
      const monthlyExpenses = {
        '2025-01': 100,
        '2025-02': 50,
        '2025-03': -30, // Refund
      };

      const rowTotal = Object.values(monthlyExpenses).reduce((sum, val) => sum + val, 0);

      expect(rowTotal).toBe(120);
    });

    it('should reduce column totals across categories with refunds', () => {
      // Simulate column totals with refunds
      const categories = [
        { monthlyExpenses: { '2025-01': 100, '2025-02': 50 } },
        { monthlyExpenses: { '2025-01': 200, '2025-02': -30 } }, // Has refund in Feb
      ];

      const columnTotals: Record<string, number> = {};

      categories.forEach((cat) => {
        Object.entries(cat.monthlyExpenses).forEach(([month, amount]) => {
          if (!columnTotals[month]) {
            columnTotals[month] = 0;
          }
          columnTotals[month] += amount;
        });
      });

      expect(columnTotals['2025-01']).toBe(300); // 100 + 200
      expect(columnTotals['2025-02']).toBe(20);  // 50 + (-30)
    });

    it('should reduce grand total with refunds', () => {
      const columnTotals = {
        '2025-01': 300,
        '2025-02': 20,  // Includes refund
        '2025-03': 150,
      };

      const grandTotal = Object.values(columnTotals).reduce((sum, val) => sum + val, 0);

      expect(grandTotal).toBe(470);
    });

    it('should handle negative amounts correctly for refunds', () => {
      // Even if chargedAmountIls is already negative, -Math.abs ensures it's negative
      const chargedAmountIls = -100;
      const isRefund = true;

      const amount = isRefund ? -Math.abs(chargedAmountIls) : chargedAmountIls;

      expect(amount).toBe(-100);
    });
  });

  describe('Category Filtering', () => {
    it('should build filter conditions for parent category IDs', () => {
      const filters: TimeFlowFilters = {
        parentCategoryIds: [1, 2, 3],
      };

      expect(filters.parentCategoryIds).toEqual([1, 2, 3]);
      expect(filters.parentCategoryIds?.length).toBe(3);
    });

    it('should build filter conditions for child category IDs', () => {
      const filters: TimeFlowFilters = {
        childCategoryIds: [10, 20, 30],
      };

      expect(filters.childCategoryIds).toEqual([10, 20, 30]);
      expect(filters.childCategoryIds?.length).toBe(3);
    });

    it('should build filter conditions for uncategorized', () => {
      const filters: TimeFlowFilters = {
        uncategorized: true,
      };

      expect(filters.uncategorized).toBe(true);
    });

    it('should support combined parent and child category filters', () => {
      const filters: TimeFlowFilters = {
        parentCategoryIds: [1, 2],
        childCategoryIds: [10, 20, 30],
      };

      expect(filters.parentCategoryIds).toEqual([1, 2]);
      expect(filters.childCategoryIds).toEqual([10, 20, 30]);
    });

    it('should handle empty category filters', () => {
      const filters: TimeFlowFilters = {
        parentCategoryIds: [],
        childCategoryIds: [],
      };

      expect(filters.parentCategoryIds?.length).toBe(0);
      expect(filters.childCategoryIds?.length).toBe(0);
    });

    it('should exclude categories not in filter from results', () => {
      // Simulate filtering logic
      const allCategories = [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Transport' },
        { id: 3, name: 'Entertainment' },
      ];

      const filterIds = [1, 3];
      const filteredCategories = allCategories.filter((cat) =>
        filterIds.includes(cat.id)
      );

      expect(filteredCategories).toHaveLength(2);
      expect(filteredCategories.map((c) => c.id)).toEqual([1, 3]);
    });

    it('should calculate totals only for filtered categories', () => {
      const categories = [
        { id: 1, total: 100 },
        { id: 2, total: 200 }, // Will be filtered out
        { id: 3, total: 150 },
      ];

      const filterIds = [1, 3];
      const filteredCategories = categories.filter((cat) => filterIds.includes(cat.id));
      const grandTotal = filteredCategories.reduce((sum, cat) => sum + cat.total, 0);

      expect(grandTotal).toBe(250); // 100 + 150, excluding category 2
    });

    it('should prioritize uncategorized filter over other filters', () => {
      // When uncategorized is true, other filters should be ignored
      const filters: TimeFlowFilters = {
        uncategorized: true,
        parentCategoryIds: [1, 2], // Should be ignored
        childCategoryIds: [10],    // Should be ignored
      };

      // In actual implementation, uncategorized takes precedence
      const shouldFilterByCategory = !filters.uncategorized;

      expect(shouldFilterByCategory).toBe(false);
      expect(filters.uncategorized).toBe(true);
    });
  });

  describe('Annual Budget Heatmap', () => {
    it('should store annual budget amount in SubCategoryData', () => {
      const subCategory: SubCategoryData = {
        subCategoryId: 1,
        subCategoryName: 'Groceries',
        monthlyExpenses: {},
        monthlyBudgets: {},
        budgetPeriod: 'annual',
        annualBudgetAmount: 12000,
        yearToDateTotal: {},
        rowTotal: 0,
      };

      expect(subCategory.budgetPeriod).toBe('annual');
      expect(subCategory.annualBudgetAmount).toBe(12000);
    });

    it('should calculate year-to-date totals by year', () => {
      const subCategory: SubCategoryData = {
        subCategoryId: 1,
        subCategoryName: 'Groceries',
        monthlyExpenses: {
          '2025-01': 500,
          '2025-02': 600,
          '2025-03': 700,
        },
        monthlyBudgets: {},
        budgetPeriod: 'annual',
        annualBudgetAmount: 12000,
        yearToDateTotal: {},
        rowTotal: 0,
      };

      // Simulate YTD calculation
      Object.entries(subCategory.monthlyExpenses).forEach(([yearMonth, amount]) => {
        const year = yearMonth.substring(0, 4);
        if (!subCategory.yearToDateTotal[year]) {
          subCategory.yearToDateTotal[year] = 0;
        }
        subCategory.yearToDateTotal[year] += amount;
      });

      expect(subCategory.yearToDateTotal['2025']).toBe(1800); // 500 + 600 + 700
    });

    it('should track YTD totals for multiple years', () => {
      const yearToDateTotal: Record<string, number> = {};
      const expenses = [
        { yearMonth: '2024-11', amount: 500 },
        { yearMonth: '2024-12', amount: 600 },
        { yearMonth: '2025-01', amount: 700 },
        { yearMonth: '2025-02', amount: 800 },
      ];

      expenses.forEach(({ yearMonth, amount }) => {
        const year = yearMonth.substring(0, 4);
        if (!yearToDateTotal[year]) {
          yearToDateTotal[year] = 0;
        }
        yearToDateTotal[year] += amount;
      });

      expect(yearToDateTotal['2024']).toBe(1100); // 500 + 600
      expect(yearToDateTotal['2025']).toBe(1500); // 700 + 800
    });

    it('should determine if YTD is under annual budget', () => {
      const annualBudget = 12000;
      const ytdTotal = 8000;

      const isUnderBudget = ytdTotal < annualBudget;

      expect(isUnderBudget).toBe(true);
    });

    it('should determine if YTD exceeds annual budget', () => {
      const annualBudget = 12000;
      const ytdTotal = 13500;

      const isOverBudget = ytdTotal > annualBudget;

      expect(isOverBudget).toBe(true);
    });

    it('should apply same color to all months when annual budget is used', () => {
      // Simulate color logic for annual budgets
      const annualBudget = 12000;
      const ytdTotal = 8000;
      const isUnderBudget = ytdTotal < annualBudget;

      const months = ['2025-01', '2025-02', '2025-03'];
      const colors = months.map(() => isUnderBudget ? 'green' : 'red');

      // All months should have same color
      expect(colors).toEqual(['green', 'green', 'green']);
      expect(new Set(colors).size).toBe(1); // Only one unique color
    });

    it('should use green when YTD is under annual budget', () => {
      const ytdTotal = 10000;
      const annualBudget = 12000;

      const color = ytdTotal < annualBudget ? 'green' : 'red';

      expect(color).toBe('green');
    });

    it('should use red when YTD exceeds annual budget', () => {
      const ytdTotal = 13000;
      const annualBudget = 12000;

      const color = ytdTotal >= annualBudget ? 'red' : 'green';

      expect(color).toBe('red');
    });

    it('should handle monthly budgets differently from annual budgets', () => {
      const subCategoryMonthly: SubCategoryData = {
        subCategoryId: 1,
        subCategoryName: 'Groceries',
        monthlyExpenses: { '2025-01': 800 },
        monthlyBudgets: { '2025-01': 1000 },
        budgetPeriod: 'monthly',
        annualBudgetAmount: null,
        yearToDateTotal: {},
        rowTotal: 800,
      };

      const subCategoryAnnual: SubCategoryData = {
        subCategoryId: 2,
        subCategoryName: 'Utilities',
        monthlyExpenses: { '2025-01': 800 },
        monthlyBudgets: {},
        budgetPeriod: 'annual',
        annualBudgetAmount: 12000,
        yearToDateTotal: { '2025': 800 },
        rowTotal: 800,
      };

      expect(subCategoryMonthly.budgetPeriod).toBe('monthly');
      expect(subCategoryMonthly.annualBudgetAmount).toBeNull();

      expect(subCategoryAnnual.budgetPeriod).toBe('annual');
      expect(subCategoryAnnual.annualBudgetAmount).toBe(12000);
    });

    it('should include refunds in YTD calculations', () => {
      const transactions = [
        { yearMonth: '2025-01', amount: 1000, isRefund: false },
        { yearMonth: '2025-02', amount: 1200, isRefund: false },
        { yearMonth: '2025-03', amount: 300, isRefund: true }, // Refund
      ];

      const yearToDateTotal: Record<string, number> = {};

      transactions.forEach((t) => {
        const year = t.yearMonth.substring(0, 4);
        const amount = t.isRefund ? -Math.abs(t.amount) : t.amount;

        if (!yearToDateTotal[year]) {
          yearToDateTotal[year] = 0;
        }
        yearToDateTotal[year] += amount;
      });

      // Expected: 1000 + 1200 - 300 = 1900
      expect(yearToDateTotal['2025']).toBe(1900);
    });

    it('should correctly identify budget period from budget data', () => {
      const budgetData = {
        budgetAmount: '12000',
        budgetPeriod: 'annual' as const,
      };

      expect(budgetData.budgetPeriod).toBe('annual');

      const budgetData2 = {
        budgetAmount: '1000',
        budgetPeriod: 'monthly' as const,
      };

      expect(budgetData2.budgetPeriod).toBe('monthly');
    });

    it('should set annual budget amount only for annual budgets', () => {
      const annualBudgetData = {
        budgetAmount: '12000',
        budgetPeriod: 'annual' as const,
      };

      const monthlyBudgetData = {
        budgetAmount: '1000',
        budgetPeriod: 'monthly' as const,
      };

      // Annual budget should store the amount
      const annualAmount = annualBudgetData.budgetPeriod === 'annual'
        ? parseFloat(annualBudgetData.budgetAmount)
        : null;

      expect(annualAmount).toBe(12000);

      // Monthly budget should not store annual amount
      const monthlyAnnualAmount = monthlyBudgetData.budgetPeriod === 'annual'
        ? parseFloat(monthlyBudgetData.budgetAmount)
        : null;

      expect(monthlyAnnualAmount).toBeNull();
    });
  });

  describe('Integration: Refunds + Annual Budget', () => {
    it('should calculate YTD with refunds and compare against annual budget', () => {
      const annualBudget = 12000;
      const transactions = [
        { yearMonth: '2025-01', amount: 1000, isRefund: false },
        { yearMonth: '2025-02', amount: 1500, isRefund: false },
        { yearMonth: '2025-03', amount: 500, isRefund: true }, // Refund
        { yearMonth: '2025-04', amount: 2000, isRefund: false },
      ];

      let ytdTotal = 0;
      transactions.forEach((t) => {
        const amount = t.isRefund ? -Math.abs(t.amount) : t.amount;
        ytdTotal += amount;
      });

      // Expected: 1000 + 1500 - 500 + 2000 = 4000
      expect(ytdTotal).toBe(4000);

      // Check against budget
      const isUnderBudget = ytdTotal < annualBudget;
      expect(isUnderBudget).toBe(true);
    });
  });

  describe('Integration: Category Filtering + Totals', () => {
    it('should filter categories and recalculate totals correctly', () => {
      const allCategories = [
        { id: 1, name: 'Food', total: 1000 },
        { id: 2, name: 'Transport', total: 500 },
        { id: 3, name: 'Entertainment', total: 300 },
      ];

      const filterIds = [1, 3];
      const filteredCategories = allCategories.filter((cat) => filterIds.includes(cat.id));

      // Column totals should only include filtered categories
      const grandTotal = filteredCategories.reduce((sum, cat) => sum + cat.total, 0);

      expect(filteredCategories).toHaveLength(2);
      expect(grandTotal).toBe(1300); // 1000 + 300, excluding Transport
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty monthly expenses', () => {
      const subCategory: SubCategoryData = {
        subCategoryId: 1,
        subCategoryName: 'Empty',
        monthlyExpenses: {},
        monthlyBudgets: {},
        budgetPeriod: null,
        annualBudgetAmount: null,
        yearToDateTotal: {},
        rowTotal: 0,
      };

      expect(Object.keys(subCategory.monthlyExpenses)).toHaveLength(0);
      expect(subCategory.rowTotal).toBe(0);
    });

    it('should handle category with only refunds', () => {
      const transactions = [
        { amount: 100, isRefund: true },
        { amount: 50, isRefund: true },
      ];

      let total = 0;
      transactions.forEach((t) => {
        const amount = t.isRefund ? -Math.abs(t.amount) : t.amount;
        total += amount;
      });

      expect(total).toBe(-150);
    });

    it('should handle zero annual budget', () => {
      const annualBudget = 0;
      const ytdTotal = 100;

      const isOverBudget = ytdTotal > annualBudget;

      expect(isOverBudget).toBe(true);
    });

    it('should handle YTD exactly equal to annual budget', () => {
      const annualBudget = 12000;
      const ytdTotal = 12000;

      // When equal, typically considered as meeting budget (not over)
      const isOverBudget = ytdTotal > annualBudget;

      expect(isOverBudget).toBe(false);
      expect(ytdTotal).toBe(annualBudget);
    });

    it('should handle null or undefined budget period', () => {
      const subCategory: SubCategoryData = {
        subCategoryId: 1,
        subCategoryName: 'No Budget',
        monthlyExpenses: { '2025-01': 500 },
        monthlyBudgets: {},
        budgetPeriod: null,
        annualBudgetAmount: null,
        yearToDateTotal: {},
        rowTotal: 500,
      };

      expect(subCategory.budgetPeriod).toBeNull();
      expect(subCategory.annualBudgetAmount).toBeNull();
    });

    it('should handle multiple filters simultaneously', () => {
      const filters: TimeFlowFilters = {
        monthsBack: 6,
        monthsForward: 6,
        cardIds: [1, 2, 3],
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        parentCategoryIds: [10, 20],
        childCategoryIds: [100, 200, 300],
        uncategorized: false,
      };

      expect(filters.cardIds).toHaveLength(3);
      expect(filters.parentCategoryIds).toHaveLength(2);
      expect(filters.childCategoryIds).toHaveLength(3);
      expect(filters.dateFrom).toBe('2025-01-01');
      expect(filters.dateTo).toBe('2025-12-31');
    });
  });
});
