'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface CategoryBreakdownChartProps {
  data: Array<{
    category: string;
    spending: number;
  }>;
}

// All 10 chart CSS vars — perceptually distinct, dark-mode aware
const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
];

function getCategoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function CustomTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{name}</p>
      <p className="text-foreground font-semibold">{formatCurrency(value)}</p>
      <p className="text-muted-foreground">{pct}% of total</p>
    </div>
  );
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const filteredData = data.filter((item) => item.spending > 0);
  const total = filteredData.reduce((sum, item) => sum + item.spending, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {!mounted || filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            {!mounted ? 'Loading...' : 'No spending data for this period'}
          </div>
        ) : (
          <div className="flex gap-4 items-center">
            <div className="h-[220px] w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredData}
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="spending"
                    nameKey="category"
                  >
                    {filteredData.map((entry) => (
                      <Cell key={entry.category} fill={getCategoryColor(entry.category)} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {filteredData
                .sort((a, b) => b.spending - a.spending)
                .slice(0, 7)
                .map((item) => {
                  const pct = ((item.spending / total) * 100).toFixed(0);
                  return (
                    <div key={item.category} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getCategoryColor(item.category) }}
                      />
                      <span className="flex-1 truncate text-foreground">{item.category}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
