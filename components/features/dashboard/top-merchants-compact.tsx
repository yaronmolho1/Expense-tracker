import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store } from 'lucide-react';
import type { TopBusinessRow } from '@/lib/services/reports-service';

interface TopMerchantsCompactProps {
  merchants: TopBusinessRow[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export function TopMerchantsCompact({ merchants }: TopMerchantsCompactProps) {
  if (merchants.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Merchants This Month</CardTitle>
          <Store className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No transactions this month</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Top Merchants This Month</CardTitle>
        <Store className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {merchants.map((merchant, index) => (
            <div key={merchant.businessId} className="flex items-center gap-3 px-6 py-3">
              <span className="text-xs font-medium text-muted-foreground w-4 shrink-0">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium truncate">
                {merchant.businessName}
              </span>
              <span className="text-sm font-semibold tabular-nums shrink-0">
                {formatCurrency(merchant.net)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
