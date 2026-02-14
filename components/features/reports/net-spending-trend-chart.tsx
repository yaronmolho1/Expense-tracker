'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import type { MonthlyTrendRow } from '@/lib/services/reports-service';

interface NetSpendingTrendChartProps {
  data: MonthlyTrendRow[];
  /** Optional second dataset for comparison mode */
  comparisonData?: MonthlyTrendRow[];
  primaryLabel?: string;
  comparisonLabel?: string;
}

const chartConfig = {
  net: { label: 'Net Spending', color: 'var(--chart-1)' },
  comparison: { label: 'Comparison', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatMonthLabel = (month: string) => {
  const [y, m] = month.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
};

function TrendTooltip({
  active,
  payload,
  label,
  primaryLabel,
  comparisonLabel,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  primaryLabel?: string;
  comparisonLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm min-w-[160px]">
      <p className="font-medium text-muted-foreground mb-2">{label}</p>
      {payload.map((entry: any) => {
        const isComparison = entry.dataKey === 'comparison';
        const periodLabel = isComparison ? (comparisonLabel ?? 'Previous') : (primaryLabel ?? 'Current');
        const row = entry.payload;
        return (
          <div key={entry.dataKey} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-muted-foreground">{periodLabel}</span>
            </div>
            <p className="text-foreground font-semibold text-base pl-4">
              {formatCurrency(entry.value)}
            </p>
            {!isComparison && row.refunds > 0 && (
              <p className="text-xs text-muted-foreground pl-4">
                Saved {formatCurrency(row.refunds)} in refunds
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NetSpendingTrendChart({
  data,
  comparisonData,
  primaryLabel,
  comparisonLabel,
}: NetSpendingTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasComparison = !!comparisonData?.length;

  // Merge primary and comparison into aligned rows by position
  const chartData = data.map((d, i) => ({
    label: formatMonthLabel(d.month),
    net: d.net,
    refunds: d.refunds,
    ...(hasComparison && comparisonData![i]
      ? { comparison: comparisonData![i].net }
      : hasComparison
      ? { comparison: 0 }
      : {}),
  }));

  if (!mounted || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Spending Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[380px] text-muted-foreground text-sm">
            {!mounted ? 'Loading...' : 'No data available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Net Spending Trend</CardTitle>
        {hasComparison && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
              {primaryLabel ?? 'Current'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--chart-3)' }} />
              {comparisonLabel ?? 'Previous'}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[380px] w-full">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            barCategoryGap={hasComparison ? '15%' : '30%'}
            barGap={3}
          >
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`}
            />
            <ChartTooltip
              cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
              content={
                <TrendTooltip
                  primaryLabel={primaryLabel}
                  comparisonLabel={comparisonLabel}
                />
              }
            />
            {hasComparison && (
              <Bar
                dataKey="comparison"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
                opacity={0.7}
              />
            )}
            <Bar
              dataKey="net"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
