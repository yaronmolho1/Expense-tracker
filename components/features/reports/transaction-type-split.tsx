'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, CreditCard, RefreshCw } from 'lucide-react';
import type { TransactionTypeSplitRow } from '@/lib/services/reports-service';

interface TransactionTypeSplitProps {
  data: TransactionTypeSplitRow[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  one_time: {
    label: 'One-time',
    icon: <Receipt className="h-4 w-4" />,
    color: 'text-chart-1',
  },
  installment: {
    label: 'Installments',
    icon: <CreditCard className="h-4 w-4" />,
    color: 'text-chart-2',
  },
  subscription: {
    label: 'Subscriptions',
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'text-chart-4',
  },
};

export function TransactionTypeSplit({ data }: TransactionTypeSplitProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Payment Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {data.map((row) => {
            const meta = TYPE_META[row.type];
            return (
              <div key={row.type} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {meta.icon}
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <div className="text-lg font-bold">{formatCurrency(row.net)}</div>
                {row.refunds > 0 && (
                  <div className="text-xs text-green-600">−{formatCurrency(row.refunds)}</div>
                )}
                <div className="text-xs text-muted-foreground">{formatCurrency(row.gross)} gross</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
