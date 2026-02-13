import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Calendar, BarChart3, RotateCcw } from 'lucide-react';
import type { DashboardKPIs } from '@/hooks/use-dashboard';

interface KPICardsProps {
  kpis: DashboardKPIs;
  selectedMonthLabel: string;
  prevMonthLabel: string;
  avgLabel: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatPercent = (percent: number) =>
  `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;

export function KPICards({ kpis, selectedMonthLabel, prevMonthLabel, avgLabel }: KPICardsProps) {
  const isMoreSpending = kpis.changeFromPrev > 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Net Selected Period */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{selectedMonthLabel} (Net)</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.thisMonth.net)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            {isMoreSpending ? (
              <TrendingUp className="h-3 w-3 text-red-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-500" />
            )}
            <span className={isMoreSpending ? 'text-red-500' : 'text-green-500'}>
              {formatPercent(kpis.changeFromPrev)}
            </span>
            <span>vs {prevMonthLabel.toLowerCase()}</span>
          </div>
          {kpis.thisMonth.refunds > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(kpis.thisMonth.gross)} gross
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refunds Selected Period */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Refunds — {selectedMonthLabel}</CardTitle>
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {kpis.thisMonth.refunds > 0
              ? formatCurrency(kpis.thisMonth.refunds)
              : '—'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.thisMonth.refunds > 0
              ? `saved vs ${formatCurrency(kpis.thisMonth.gross)} gross`
              : 'No refunds'}
          </p>
        </CardContent>
      </Card>

      {/* Net Prev Period */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{prevMonthLabel} (Net)</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.lastMonth.net)}</div>
          {kpis.lastMonth.refunds > 0 ? (
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(kpis.lastMonth.gross)} gross − {formatCurrency(kpis.lastMonth.refunds)} refunds
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Previous period</p>
          )}
        </CardContent>
      </Card>

      {/* Avg */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{avgLabel}</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.avgNet)}</div>
          <p className="text-xs text-muted-foreground mt-1">Net average</p>
        </CardContent>
      </Card>
    </div>
  );
}
