'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import type { CategoryBreakdownRow } from '@/lib/services/reports-service';

interface CategoryBreakdownPanelProps {
  data: CategoryBreakdownRow[];
  colorMap: Map<number, string>;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

function PieTooltip({ active, payload, totalNet }: { active?: boolean; payload?: any[]; totalNet: number }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: row } = payload[0];
  const pct = totalNet > 0 ? ((value / totalNet) * 100).toFixed(1) : '0.0';
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm min-w-[160px]">
      <p className="font-medium mb-1.5">{name}</p>
      <p className="text-foreground font-semibold text-base">{formatCurrency(value)}</p>
      <p className="text-muted-foreground">{pct}% of total</p>
      {row.refunds > 0 && (
        <p className="text-xs text-muted-foreground mt-1">Saved {formatCurrency(row.refunds)}</p>
      )}
    </div>
  );
}

export function CategoryBreakdownPanel({ data, colorMap }: CategoryBreakdownPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  useEffect(() => { setMounted(true); }, []);

  const displayData = selectedParentId !== null
    ? (data.find((d) => d.categoryId === selectedParentId)?.children ?? []).map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        net: c.net,
        gross: c.gross,
        refunds: c.refunds,
        percentage: 0,
        children: [],
      }))
    : data;

  const selectedParent = selectedParentId !== null
    ? data.find((d) => d.categoryId === selectedParentId)
    : null;

  const totalNet = displayData.reduce((s, d) => s + d.net, 0);
  const pieData = displayData.filter((d) => d.net > 0);

  // Build a minimal ChartConfig for ChartContainer (required)
  const chartConfig: ChartConfig = Object.fromEntries(
    pieData.map((d) => [
      `cat_${d.categoryId}`,
      { label: d.categoryName, color: colorMap.get(d.categoryId) ?? 'var(--muted-foreground)' },
    ])
  );

  if (!mounted) {
    return (
      <Card>
        <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[340px] text-muted-foreground text-sm">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        {selectedParentId !== null && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedParentId(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <CardTitle>
          {selectedParent ? `${selectedParent.categoryName} — Sub-categories` : 'Category Breakdown'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">No data available</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Donut chart */}
            <div className="h-[240px] w-full md:w-[220px] shrink-0">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="net"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="80%"
                    paddingAngle={2}
                    onClick={(entry) => {
                      if (selectedParentId === null) {
                        const original = data.find((d) => d.categoryName === entry.categoryName);
                        if (original && original.children.length > 0) {
                          setSelectedParentId(original.categoryId);
                        }
                      }
                    }}
                    style={{ cursor: selectedParentId === null ? 'pointer' : 'default' }}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.categoryId}
                        fill={
                          selectedParentId !== null
                            ? colorMap.get(selectedParentId) ?? 'var(--chart-1)'
                            : colorMap.get(entry.categoryId) ?? 'var(--muted-foreground)'
                        }
                        opacity={selectedParentId !== null ? 0.5 + 0.5 * ((pieData.indexOf(entry) % 3 === 0) ? 1 : 0.6) : 1}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<PieTooltip totalNet={totalNet} />} />
                </PieChart>
              </ChartContainer>
            </div>

            {/* Net-only ranked table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left pb-2 font-medium">Category</th>
                    <th className="text-right pb-2 font-medium">Net</th>
                    <th className="text-right pb-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData
                    .filter((d) => d.net > 0)
                    .sort((a, b) => b.net - a.net)
                    .map((row) => {
                      const pct = totalNet > 0 ? ((row.net / totalNet) * 100).toFixed(1) : '0.0';
                      const color =
                        selectedParentId !== null
                          ? colorMap.get(selectedParentId) ?? 'var(--chart-1)'
                          : colorMap.get(row.categoryId) ?? 'var(--muted-foreground)';
                      const hasChildren =
                        selectedParentId === null &&
                        (data.find((d) => d.categoryId === row.categoryId)?.children.length ?? 0) > 0;
                      return (
                        <tr
                          key={row.categoryId}
                          className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${hasChildren ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (hasChildren) setSelectedParentId(row.categoryId);
                          }}
                        >
                          <td className="py-2.5 flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{row.categoryName}</span>
                            {hasChildren && (
                              <ChevronLeft className="h-3 w-3 text-muted-foreground rotate-180 ml-auto shrink-0" />
                            )}
                          </td>
                          <td className="py-2.5 text-right font-medium tabular-nums">
                            {formatCurrency(row.net)}
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {selectedParentId === null && (
                <p className="text-xs text-muted-foreground mt-3">Click a category to drill into sub-categories.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
