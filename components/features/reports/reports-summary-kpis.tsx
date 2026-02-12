'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ReceiptText, BarChart3 } from 'lucide-react';
import type { ReportsSummary } from '@/lib/services/reports-service';

interface ReportsSummaryKPIsProps {
  summary: ReportsSummary;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export function ReportsSummaryKPIs({ summary }: ReportsSummaryKPIsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {/* Gross Spending */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Spending</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.gross)}</div>
          <p className="text-xs text-muted-foreground mt-1">Before refunds</p>
        </CardContent>
      </Card>

      {/* Refunds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Refunds</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.refunds)}</div>
          <p className="text-xs text-muted-foreground mt-1">Money returned</p>
        </CardContent>
      </Card>

      {/* Net Spending */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Spending</CardTitle>
          <ReceiptText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.net)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.refunds > 0
              ? `Saved ${formatCurrency(summary.refunds)} in refunds`
              : 'No refunds in period'}
          </p>
        </CardContent>
      </Card>

      {/* Monthly Average */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Avg</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.monthlyAvgNet)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Over {summary.monthCount} month{summary.monthCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
