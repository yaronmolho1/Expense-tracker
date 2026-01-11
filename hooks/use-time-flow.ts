import { useQuery } from '@tanstack/react-query';

export interface TimeFlowFilters {
  monthsBack?: number;
  monthsForward?: number;
  cardIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface SubCategoryData {
  subCategoryId: number | null;
  subCategoryName: string | null;
  monthlyExpenses: Record<string, number>;
  monthlyBudgets: Record<string, number>; // Added: budget per month
  rowTotal: number;
}

export interface MainCategoryData {
  mainCategoryId: number;
  mainCategoryName: string;
  subCategories: SubCategoryData[];
  categoryTotal: number;
}

export interface TimeFlowResponse {
  months: string[];
  categories: MainCategoryData[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

async function fetchTimeFlow(filters: TimeFlowFilters): Promise<TimeFlowResponse> {
  const params = new URLSearchParams();

  if (filters.monthsBack !== undefined) params.set('months_back', filters.monthsBack.toString());
  if (filters.monthsForward !== undefined) params.set('months_forward', filters.monthsForward.toString());
  if (filters.cardIds?.length) params.set('card_ids', filters.cardIds.join(','));
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const response = await fetch(`/api/time-flow?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch time-flow data');
  }

  return response.json();
}

export function useTimeFlow(filters: TimeFlowFilters = {}) {
  return useQuery({
    queryKey: ['time-flow', filters],
    queryFn: () => fetchTimeFlow(filters),
    staleTime: 0, // Disable stale time to always refetch on invalidation
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}
