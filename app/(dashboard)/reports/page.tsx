'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { useReports } from '@/hooks/use-reports';
import { buildCategoryColorMap } from '@/lib/utils/category-colors';
import { ReportsFilters, getDefaultReportsFilters } from '@/components/features/reports/reports-filters';
import { ReportsSummaryKPIs } from '@/components/features/reports/reports-summary-kpis';
import { NetSpendingTrendChart } from '@/components/features/reports/net-spending-trend-chart';
import { CategoryBreakdownPanel } from '@/components/features/reports/category-breakdown-panel';
import { CategoryTrendsChart } from '@/components/features/reports/category-trends-chart';
import { TopBusinessesTable } from '@/components/features/reports/top-businesses-table';
import { TransactionTypeSplit } from '@/components/features/reports/transaction-type-split';

import type { ReportsFilterState } from '@/components/features/reports/reports-filters';

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportsFilterState>(getDefaultReportsFilters());

  const queryFilters = useMemo(() => ({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    cardIds: filters.cardIds.length ? filters.cardIds : undefined,
    parentCategoryIds: filters.parentCategoryIds.length ? filters.parentCategoryIds : undefined,
  }), [filters]);

  const { data, isLoading, error } = useReports(queryFilters);

  const colorMap = useMemo(
    () => buildCategoryColorMap(data?.categoryMeta ?? []),
    [data?.categoryMeta]
  );

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h3 className="font-semibold">Error loading reports</h3>
          <p className="text-sm mt-1">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Reports"
        description="Analyse spending patterns, trends and refunds across all categories"
      />

      <ReportsFilters filters={filters} onFilterChange={setFilters} />

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-[350px]" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[380px]" />
            <Skeleton className="h-[380px]" />
          </div>
          <Skeleton className="h-[350px]" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[320px]" />
            <Skeleton className="h-[180px]" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* A: Summary KPIs */}
          <ReportsSummaryKPIs summary={data.summary} />

          {/* B: Net Spending Trend */}
          <NetSpendingTrendChart data={data.monthlyTrend} />

          {/* C + D: Category Breakdown + Trends */}
          <div className="grid gap-6 md:grid-cols-2">
            <CategoryBreakdownPanel data={data.categoryBreakdown} colorMap={colorMap} />
            <CategoryTrendsChart
              data={data.categoryTrends}
              categoryMeta={data.categoryMeta}
              colorMap={colorMap}
            />
          </div>

          {/* E + F: Top Businesses + Type Split */}
          <div className="grid gap-6 md:grid-cols-2">
            <TopBusinessesTable data={data.topBusinesses} />
            <TransactionTypeSplit data={data.byTransactionType} />
          </div>
        </div>
      )}
    </div>
  );
}
