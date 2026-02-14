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

function formatPeriodLabel(dateFrom: string, dateTo: string) {
  const fmtLabel = (d: string) => {
    const [y, m] = d.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };
  const from = fmtLabel(dateFrom);
  const to = fmtLabel(dateTo);
  return from === to ? from : `${from} – ${to}`;
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportsFilterState>(getDefaultReportsFilters());

  const queryFilters = useMemo(() => ({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    cardIds: filters.cardIds.length ? filters.cardIds : undefined,
    parentCategoryIds: filters.parentCategoryIds.length ? filters.parentCategoryIds : undefined,
  }), [filters]);

  const comparisonQueryFilters = useMemo(() => {
    if (!filters.comparisonDateFrom) return null;
    return {
      dateFrom: filters.comparisonDateFrom,
      dateTo: filters.comparisonDateTo!,
      cardIds: filters.cardIds.length ? filters.cardIds : undefined,
      parentCategoryIds: filters.parentCategoryIds.length ? filters.parentCategoryIds : undefined,
    };
  }, [filters]);

  const { data, isLoading, error } = useReports(queryFilters);
  const { data: comparisonData, isLoading: isComparisonLoading } = useReports(
    comparisonQueryFilters ?? queryFilters,
    { enabled: !!comparisonQueryFilters }
  );

  const colorMap = useMemo(
    () => buildCategoryColorMap(data?.categoryMeta ?? []),
    [data?.categoryMeta]
  );

  const hasComparison = !!comparisonQueryFilters && !!comparisonData;
  const primaryLabel = hasComparison ? formatPeriodLabel(filters.dateFrom, filters.dateTo) : undefined;
  const comparisonLabel = hasComparison && filters.comparisonDateFrom
    ? formatPeriodLabel(filters.comparisonDateFrom, filters.comparisonDateTo!)
    : undefined;

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

  const isAnyLoading = isLoading || !data || (!!comparisonQueryFilters && isComparisonLoading);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Reports"
        description="Analyse spending patterns, trends and categories across any period"
      />

      <ReportsFilters filters={filters} onFilterChange={setFilters} />

      {isAnyLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[420px]" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[320px]" />
            <Skeleton className="h-[180px]" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* A: Summary KPIs */}
          <ReportsSummaryKPIs
            summary={data.summary}
            comparisonSummary={hasComparison ? comparisonData!.summary : undefined}
            primaryLabel={primaryLabel}
            comparisonLabel={comparisonLabel}
          />

          {/* B: Net Spending Trend — full width */}
          <NetSpendingTrendChart
            data={data.monthlyTrend}
            comparisonData={hasComparison ? comparisonData!.monthlyTrend : undefined}
            primaryLabel={primaryLabel}
            comparisonLabel={comparisonLabel}
          />

          {/* C: Category Breakdown — full width */}
          <CategoryBreakdownPanel data={data.categoryBreakdown} colorMap={colorMap} />

          {/* D: Category Trends — full width (many lines need the space) */}
          <CategoryTrendsChart
            data={data.categoryTrends}
            categoryMeta={data.categoryMeta}
            colorMap={colorMap}
          />

          {/* E + F: Top Merchants + Transaction Type Split */}
          <div className="grid gap-6 md:grid-cols-2">
            <TopBusinessesTable data={data.topBusinesses} />
            <TransactionTypeSplit data={data.byTransactionType} />
          </div>
        </div>
      )}
    </div>
  );
}
