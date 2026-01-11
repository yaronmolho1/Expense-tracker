import { useQuery } from '@tanstack/react-query';

export interface DashboardData {
  kpis: {
    thisMonth: number;
    lastMonth: number;
    sixMonthAverage: number;
    changeFromLastMonth: number;
  };
  monthlyTrend: Array<{
    month: string;
    spending: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    spending: number;
  }>;
  recentTransactions: Array<{
    id: number;
    businessName: string;
    amount: number;
    date: string;
    category: string;
  }>;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
