'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { MonthlyTrendRow } from '@/lib/services/reports-service';

interface NetSpendingTrendChartProps {
  data: MonthlyTrendRow[];
}

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

export function NetSpendingTrendChart({ data }: NetSpendingTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Transform data: refunds as negative values for below-axis display
  const chartData = data.map((d) => ({
    month: d.month,
    label: formatMonthLabel(d.month),
    gross: d.gross,
    refunds: -d.refunds, // negative → renders below x-axis
    net: d.net,
  }));

  if (!mounted || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Trend</CardTitle>
        </CardHeader>
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
        <CardTitle>Spending Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickMargin={6}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `₪${(Math.abs(v) / 1000).toFixed(0)}K`}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const absVal = formatCurrency(Math.abs(value));
                  const labels: Record<string, string> = {
                    gross: 'Gross',
                    refunds: 'Refunds',
                    net: 'Net',
                  };
                  return [absVal, labels[name] ?? name];
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = { gross: 'Gross', refunds: 'Refunds', net: 'Net' };
                  return labels[value] ?? value;
                }}
              />
              <Bar dataKey="gross" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="gross" />
              <Bar dataKey="refunds" fill="hsl(var(--destructive) / 0.7)" radius={[0, 0, 3, 3]} name="refunds" />
              <Line
                type="monotone"
                dataKey="net"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="net"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
