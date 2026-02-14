'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import type { CategoryMeta } from '@/lib/services/reports-service';

interface CategoryTrendsChartProps {
  data: Array<Record<string, number | string>>;
  categoryMeta: CategoryMeta[];
  colorMap: Map<number, string>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatMonthLabel = (month: string) => {
  const [y, m] = (month as string).split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
};

function TrendsTooltip({
  active,
  payload,
  label,
  colorMap,
  categoryMeta,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  colorMap: Map<number, string>;
  categoryMeta: CategoryMeta[];
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm min-w-[180px] max-h-[260px] overflow-y-auto">
      <p className="font-medium text-muted-foreground mb-2">{label}</p>
      {sorted.map((entry) => {
        const cat = categoryMeta.find((c) => c.categoryName === entry.dataKey);
        const color = cat ? (colorMap.get(cat.categoryId) ?? 'var(--muted-foreground)') : 'var(--muted-foreground)';
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="truncate text-foreground">{entry.dataKey}</span>
            </span>
            <span className="font-medium tabular-nums shrink-0">
              {entry.value ? formatCurrency(entry.value) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CategoryTrendsChart({ data, categoryMeta, colorMap }: CategoryTrendsChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const chartData = data.map((row) => ({
    ...row,
    label: formatMonthLabel(row.month as string),
  }));

  const chartConfig: ChartConfig = Object.fromEntries(
    categoryMeta.map((cat) => [
      cat.categoryName,
      { label: cat.categoryName, color: colorMap.get(cat.categoryId) ?? 'var(--muted-foreground)' },
    ])
  );

  if (!mounted || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Spending Trends by Category</CardTitle></CardHeader>
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
      <CardHeader>
        <CardTitle>Spending Trends by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[380px] w-full">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              content={
                <TrendsTooltip colorMap={colorMap} categoryMeta={categoryMeta} />
              }
            />
            {categoryMeta.map((cat) => (
              <Line
                key={cat.categoryId}
                type="monotone"
                dataKey={cat.categoryName}
                stroke={colorMap.get(cat.categoryId) ?? 'var(--muted-foreground)'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
