import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react';

interface KPICardsProps {
  kpis: {
    thisMonth: number;
    lastMonth: number;
    sixMonthAverage: number;
    changeFromLastMonth: number;
  };
}

export function KPICards({ kpis }: KPICardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
  };

  const isPositiveChange = kpis.changeFromLastMonth > 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* This Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.thisMonth)}</div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {isPositiveChange ? (
              <TrendingUp className="mr-1 h-3 w-3 text-red-500" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3 text-green-500" />
            )}
            <span className={isPositiveChange ? 'text-red-500' : 'text-green-500'}>
              {formatPercent(kpis.changeFromLastMonth)}
            </span>
            <span className="ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Last Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Month</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.lastMonth)}</div>
          <p className="text-xs text-muted-foreground mt-1">Previous period</p>
        </CardContent>
      </Card>

      {/* 6-Month Average */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">6-Month Average</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.sixMonthAverage)}</div>
          <p className="text-xs text-muted-foreground mt-1">Rolling average</p>
        </CardContent>
      </Card>
    </div>
  );
}
