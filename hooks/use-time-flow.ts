import { useQuery } from '@tanstack/react-query';

export interface TimeFlowFilters {
  monthsBack?: number;
  monthsForward?: number;
  cardIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  parentCategoryIds?: string[];
  childCategoryIds?: string[];
  uncategorized?: boolean;
}

export interface SubCategoryData {
  subCategoryId: number | null;
  subCategoryName: string | null;
  monthlyExpenses: Record<string, number>;
  monthlyBudgets: Record<string, number>;
  budgetPeriod: 'monthly' | 'annual' | null;
  annualBudgetAmount: number | null;
  yearToDateTotal: Record<string, number>; // keyed by year (e.g., "2025")
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
  if (filters.parentCategoryIds?.length) params.set('parent_category_ids', filters.parentCategoryIds.join(','));
  if (filters.childCategoryIds?.length) params.set('child_category_ids', filters.childCategoryIds.join(','));
  if (filters.uncategorized !== undefined) params.set('uncategorized', filters.uncategorized.toString());

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
