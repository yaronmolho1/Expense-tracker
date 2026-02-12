'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
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
      }))
    : data;

  const selectedParent = selectedParentId !== null
    ? data.find((d) => d.categoryId === selectedParentId)
    : null;

  const totalNet = displayData.reduce((s, d) => s + d.net, 0);
  const pieData = displayData.filter((d) => d.net > 0);

  if (!mounted) {
    return (
      <Card>
        <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[320px] text-muted-foreground">Loading chart...</div>
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
          <div className="flex items-center justify-center h-[320px] text-muted-foreground">No data available</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            {/* Donut chart */}
            <div className="h-[260px] md:h-[320px] md:w-1/2 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="net"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
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
                            ? colorMap.get(selectedParentId) ?? 'hsl(var(--chart-1))'
                            : colorMap.get(entry.categoryId) ?? 'hsl(var(--muted-foreground))'
                        }
                        opacity={selectedParentId !== null ? 0.6 + 0.4 * (pieData.indexOf(entry) === 0 ? 1 : 0.7) : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => value !== undefined ? [formatCurrency(value), 'Net'] : ['', 'Net']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Ranked table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left pb-2 font-medium">Category</th>
                    <th className="text-right pb-2 font-medium">Gross</th>
                    <th className="text-right pb-2 font-medium text-green-600">Refunds</th>
                    <th className="text-right pb-2 font-medium">Net</th>
                    <th className="text-right pb-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData
                    .filter((d) => d.net > 0 || d.gross > 0)
                    .map((row) => {
                      const pct = totalNet > 0 ? ((row.net / totalNet) * 100).toFixed(1) : '0.0';
                      const color =
                        selectedParentId !== null
                          ? colorMap.get(selectedParentId) ?? 'hsl(var(--chart-1))'
                          : colorMap.get(row.categoryId) ?? 'hsl(var(--muted-foreground))';
                      return (
                        <tr
                          key={row.categoryId}
                          className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${
                            selectedParentId === null && data.find((d) => d.categoryId === row.categoryId)?.children.length
                              ? 'cursor-pointer'
                              : ''
                          }`}
                          onClick={() => {
                            if (selectedParentId === null) {
                              const original = data.find((d) => d.categoryId === row.categoryId);
                              if (original && original.children.length > 0) {
                                setSelectedParentId(original.categoryId);
                              }
                            }
                          }}
                        >
                          <td className="py-2 flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            {row.categoryName}
                          </td>
                          <td className="py-2 text-right">{formatCurrency(row.gross)}</td>
                          <td className="py-2 text-right text-green-600">
                            {row.refunds > 0 ? formatCurrency(row.refunds) : '—'}
                          </td>
                          <td className="py-2 text-right font-medium">{formatCurrency(row.net)}</td>
                          <td className="py-2 text-right text-muted-foreground">{pct}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {selectedParentId === null && (
                <p className="text-xs text-muted-foreground mt-3">Click a category to see sub-categories.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
