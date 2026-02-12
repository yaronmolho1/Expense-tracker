'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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

export function CategoryTrendsChart({ data, categoryMeta, colorMap }: CategoryTrendsChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Enrich data with label for X axis
  const chartData = data.map((row) => ({
    ...row,
    label: formatMonthLabel(row.month as string),
  }));

  if (!mounted || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Spending Trends by Category</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[320px] text-muted-foreground">
            {!mounted ? 'Loading chart...' : 'No data available'}
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
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickMargin={6} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              {categoryMeta.map((cat) => (
                <Line
                  key={cat.categoryId}
                  type="monotone"
                  dataKey={cat.categoryName}
                  stroke={colorMap.get(cat.categoryId) ?? 'hsl(var(--muted-foreground))'}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
