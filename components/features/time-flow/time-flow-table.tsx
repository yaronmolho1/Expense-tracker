'use client';

import React, { useState } from 'react';
import { MainCategoryData } from '@/hooks/use-time-flow';
import { ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeFlowTableProps {
  months: string[];
  categories: MainCategoryData[];
  columnTotals: Record<string, number>;
  grandTotal: number;
  onCellClick: (categoryId: number, subCategoryId: number | null, month: string) => void;
}

export function TimeFlowTable({
  months,
  categories,
  columnTotals,
  grandTotal,
  onCellClick,
}: TimeFlowTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const formatMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBudgetColor = (amount: number, budget: number | undefined) => {
    if (!budget || budget === 0) return 'text-gray-900'; // No budget
    if (amount > budget) return 'text-red-600 font-semibold'; // Over budget
    return 'text-green-600 font-semibold'; // Under/at budget
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 min-w-[200px]">
              Category
            </th>
            {months.map((month) => (
              <th
                key={month}
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]"
              >
                {formatMonth(month)}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100 min-w-[120px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {categories.map((category) => {
            const isExpanded = expandedCategories.has(category.mainCategoryId);

            // Calculate sum of sub-category budgets for parent (use first month's budget)
            const firstMonth = months[0];
            const parentTotalBudget = category.subCategories.reduce(
              (sum, sub) => {
                const budgetForMonth = sub.monthlyBudgets?.[firstMonth] || 0;
                return sum + budgetForMonth;
              },
              0
            );

            return (
              <React.Fragment key={`category-${category.mainCategoryId}`}>
                {/* Main Category Row */}
                <tr
                  key={`main-${category.mainCategoryId}`}
                  className="bg-gray-50 hover:bg-gray-100 cursor-pointer font-medium"
                  onClick={() => toggleCategory(category.mainCategoryId)}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-50 z-10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span>{category.mainCategoryName}</span>
                      </div>
                      {parentTotalBudget > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-normal">
                          <Wallet className="h-3 w-3" />
                          {formatCurrency(parentTotalBudget)}
                        </span>
                      )}
                    </div>
                  </td>
                  {months.map((month) => {
                    const total = category.subCategories.reduce(
                      (sum, sub) => sum + (sub.monthlyExpenses[month] || 0),
                      0
                    );
                    return (
                      <td
                        key={month}
                        className="px-4 py-3 text-sm text-gray-900 text-right"
                      >
                        {total > 0 ? formatCurrency(total) : '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold bg-gray-100">
                    {formatCurrency(category.categoryTotal)}
                  </td>
                </tr>

                {/* Sub-Category Rows */}
                {isExpanded &&
                  category.subCategories.map((subCategory) => (
                    <tr
                      key={`sub-${category.mainCategoryId}-${subCategory.subCategoryId}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-sm text-gray-700 sticky left-0 bg-white z-10 pl-12">
                        <div className="flex items-center justify-between gap-2">
                          <span>{subCategory.subCategoryName || 'Uncategorized'}</span>
                          {subCategory.monthlyBudgets?.[firstMonth] && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Wallet className="h-3 w-3" />
                              {formatCurrency(subCategory.monthlyBudgets[firstMonth])}
                            </span>
                          )}
                        </div>
                      </td>
                      {months.map((month) => {
                        const amount = subCategory.monthlyExpenses[month] || 0;
                        const budget = subCategory.monthlyBudgets?.[month];
                        const colorClass = getBudgetColor(amount, budget);

                        return (
                          <td
                            key={month}
                            className={cn(
                              'px-4 py-2 text-sm text-right cursor-pointer hover:ring-2 hover:ring-blue-500',
                              colorClass
                            )}
                            onClick={() =>
                              amount > 0 &&
                              onCellClick(
                                category.mainCategoryId,
                                subCategory.subCategoryId,
                                month
                              )
                            }
                          >
                            {amount > 0 ? formatCurrency(amount) : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-sm text-gray-700 text-right font-medium bg-gray-50">
                        {formatCurrency(subCategory.rowTotal)}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}

          {/* Column Totals Row */}
          <tr className="bg-gray-100 font-semibold">
            <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100 z-10">
              Total
            </td>
            {months.map((month) => (
              <td
                key={month}
                className="px-4 py-3 text-sm text-gray-900 text-right"
              >
                {formatCurrency(columnTotals[month] || 0)}
              </td>
            ))}
            <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold bg-gray-200">
              {formatCurrency(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
