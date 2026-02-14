'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReceiptText, BarChart3, TrendingDown } from 'lucide-react';
import type { ReportsSummary } from '@/lib/services/reports-service';

interface ReportsSummaryKPIsProps {
  summary: ReportsSummary;
  /** Optional comparison summary for side-by-side view */
  comparisonSummary?: ReportsSummary;
  primaryLabel?: string;
  comparisonLabel?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

function DeltaBadge({ current, comparison }: { current: number; comparison: number }) {
  if (comparison === 0) return null;
  const pct = ((current - comparison) / comparison) * 100;
  const isDecrease = pct < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        isDecrease
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      {isDecrease ? '▼' : '▲'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function ReportsSummaryKPIs({
  summary,
  comparisonSummary,
  primaryLabel,
  comparisonLabel,
}: ReportsSummaryKPIsProps) {
  const hasComparison = !!comparisonSummary;

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
      {/* Net Spending — primary KPI */}
      <Card className="md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Spending</CardTitle>
          <ReceiptText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.net)}</div>
          {hasComparison ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{comparisonLabel ?? 'vs'}: {formatCurrency(comparisonSummary!.net)}</span>
              <DeltaBadge current={summary.net} comparison={comparisonSummary!.net} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {summary.refunds > 0
                ? `Saved ${formatCurrency(summary.refunds)} in refunds`
                : `${summary.monthCount} month${summary.monthCount !== 1 ? 's' : ''}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Monthly Average */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Average</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.monthlyAvgNet)}</div>
          {hasComparison ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{comparisonLabel ?? 'vs'}: {formatCurrency(comparisonSummary!.monthlyAvgNet)}</span>
              <DeltaBadge current={summary.monthlyAvgNet} comparison={comparisonSummary!.monthlyAvgNet} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Over {summary.monthCount} month{summary.monthCount !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Refunds saved */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Refunds Saved</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(summary.refunds)}
          </div>
          {hasComparison ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{comparisonLabel ?? 'vs'}: {formatCurrency(comparisonSummary!.refunds)}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {summary.refunds > 0
                ? `${((summary.refunds / (summary.gross || 1)) * 100).toFixed(1)}% of gross`
                : 'No refunds in period'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
