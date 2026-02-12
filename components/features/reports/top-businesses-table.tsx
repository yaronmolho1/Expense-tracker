'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TopBusinessRow } from '@/lib/services/reports-service';

interface TopBusinessesTableProps {
  data: TopBusinessRow[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

type SortKey = 'net' | 'gross' | 'transactionCount';

export function TopBusinessesTable({ data }: TopBusinessesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('net');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const diff = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0;
    return sortAsc ? diff : -diff;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortAsc ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />
    ) : (
      <ArrowUpDown className="h-3 w-3 inline ml-1 text-muted-foreground" />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left pb-2 font-medium">#</th>
                <th className="text-left pb-2 font-medium">Merchant</th>
                <th className="text-left pb-2 font-medium hidden md:table-cell">Category</th>
                <th className="text-right pb-2 font-medium">
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-muted-foreground" onClick={() => handleSort('transactionCount')}>
                    Txns<SortIcon k="transactionCount" />
                  </Button>
                </th>
                <th className="text-right pb-2 font-medium hidden md:table-cell">Gross</th>
                <th className="text-right pb-2 font-medium hidden md:table-cell text-green-600">Refunds</th>
                <th className="text-right pb-2 font-medium">
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-muted-foreground" onClick={() => handleSort('net')}>
                    Net<SortIcon k="net" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr key={row.businessId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 font-medium max-w-[160px] truncate">{row.businessName}</td>
                  <td className="py-2 hidden md:table-cell">
                    <Badge variant="secondary" className="text-xs font-normal">{row.categoryName}</Badge>
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{row.transactionCount}</td>
                  <td className="py-2 text-right hidden md:table-cell">{formatCurrency(row.gross)}</td>
                  <td className="py-2 text-right text-green-600 hidden md:table-cell">
                    {row.refunds > 0 ? formatCurrency(row.refunds) : '—'}
                  </td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
