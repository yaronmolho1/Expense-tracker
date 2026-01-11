'use client';

import { useDashboard } from '@/hooks/use-dashboard';
import { KPICards } from '@/components/features/dashboard/kpi-cards';
import { SpendingTrendChart } from '@/components/features/dashboard/spending-trend-chart';
import { CategoryBreakdownChart } from '@/components/features/dashboard/category-breakdown-chart';
import { RecentTransactions } from '@/components/features/dashboard/recent-transactions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

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
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[400px]" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your spending and financial activity
        </p>
      </div>

      {/* KPI Cards */}
      <KPICards kpis={data.kpis} />

      {/* Spending Trend Chart */}
      <SpendingTrendChart data={data.monthlyTrend} />

      {/* Bottom Section: Category Breakdown + Recent Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        <CategoryBreakdownChart data={data.categoryBreakdown} />
        <RecentTransactions transactions={data.recentTransactions} />
      </div>
    </div>
  );
}
