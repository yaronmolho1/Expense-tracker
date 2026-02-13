import { useQuery } from '@tanstack/react-query';
import type { MonthlyTrendRow, TransactionTypeSplitRow, TopBusinessRow } from '@/lib/services/reports-service';

export type DashboardMode = 'this_month' | 'last_month' | 'this_year' | 'last_year';

export interface DashboardKPIs {
  thisMonth: { gross: number; refunds: number; net: number };
  lastMonth: { gross: number; refunds: number; net: number };
  avgNet: number;
  changeFromPrev: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  monthlyTrend: MonthlyTrendRow[];
  categoryBreakdown: Array<{
    category: string;
    spending: number;
  }>;
  transactionTypeSplit: TransactionTypeSplitRow[];
  topMerchants: TopBusinessRow[];
  recentTransactions: Array<{
    id: number;
    businessName: string;
    amount: number;
    date: string;
    category: string;
  }>;
}

export function useDashboard(mode: DashboardMode = 'this_month') {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', mode],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard?mode=${mode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
