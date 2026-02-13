'use client';

import { useState } from 'react';
import { subMonths, subYears, format, getYear } from 'date-fns';
import { useDashboard, type DashboardMode } from '@/hooks/use-dashboard';
import { KPICards } from '@/components/features/dashboard/kpi-cards';
import { NetSpendingTrendChart } from '@/components/features/reports/net-spending-trend-chart';
import { TransactionTypeSplit } from '@/components/features/reports/transaction-type-split';
import { CategoryBreakdownChart } from '@/components/features/dashboard/category-breakdown-chart';
import { TopMerchantsCompact } from '@/components/features/dashboard/top-merchants-compact';
import { RecentTransactions } from '@/components/features/dashboard/recent-transactions';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

const MODES: { value: DashboardMode; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
];

function getLabels(mode: DashboardMode, now: Date) {
  const isYearly = mode === 'this_year' || mode === 'last_year';

  if (mode === 'this_month') {
    return { selected: 'This Month', prev: 'Last Month', avg: '6-Month Avg (Net)' };
  }
  if (mode === 'last_month') {
    const lm = subMonths(now, 1);
    const prevM = subMonths(now, 2);
    return {
      selected: format(lm, 'MMM yyyy'),
      prev: format(prevM, 'MMM yyyy'),
      avg: '6-Month Avg (Net)',
    };
  }
  if (mode === 'this_year') {
    return {
      selected: String(getYear(now)),
      prev: String(getYear(now) - 1),
      avg: 'Monthly Avg (Net)',
    };
  }
  // last_year
  return {
    selected: String(getYear(now) - 1),
    prev: String(getYear(now) - 2),
    avg: 'Monthly Avg (Net)',
  };
}

export default function DashboardPage() {
  const [mode, setMode] = useState<DashboardMode>('this_month');
  const { data, isLoading, error } = useDashboard(mode);

  const now = new Date();
  const { selected: selectedLabel, prev: prevLabel, avg: avgLabel } = getLabels(mode, now);

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h3 className="font-semibold">Error loading dashboard</h3>
          <p className="text-sm mt-1">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-8 space-y-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[360px]" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Dashboard"
          description="Overview of your spending and financial activity"
        />

        {/* Period toggle */}
        <div className="flex shrink-0 rounded-lg border bg-muted p-1 gap-1 mt-1">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <KPICards
        kpis={data.kpis}
        selectedMonthLabel={selectedLabel}
        prevMonthLabel={prevLabel}
        avgLabel={avgLabel}
      />

      {/* Row 2: Spending Trend */}
      <NetSpendingTrendChart data={data.monthlyTrend} />

      {/* Row 3: Transaction Type Split + Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <TransactionTypeSplit data={data.transactionTypeSplit} />
        <CategoryBreakdownChart data={data.categoryBreakdown} />
      </div>

      {/* Row 4: Top Merchants + Recent Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        <TopMerchantsCompact merchants={data.topMerchants} />
        <RecentTransactions transactions={data.recentTransactions} />
      </div>
    </div>
  );
}
