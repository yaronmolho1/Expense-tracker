import { useQuery } from '@tanstack/react-query';
import type { ReportsResponse } from '@/lib/services/reports-service';

export interface ReportsFilters {
  dateFrom: string;
  dateTo: string;
  cardIds?: string[];
  parentCategoryIds?: string[];
}

async function fetchReports(filters: ReportsFilters): Promise<ReportsResponse> {
  const params = new URLSearchParams();
  params.set('date_from', filters.dateFrom);
  params.set('date_to', filters.dateTo);
  if (filters.cardIds?.length) params.set('card_ids', filters.cardIds.join(','));
  if (filters.parentCategoryIds?.length) params.set('parent_category_ids', filters.parentCategoryIds.join(','));

  const response = await fetch(`/api/reports?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch reports data');
  }
  return response.json();
}

export function useReports(filters: ReportsFilters) {
  return useQuery({
    queryKey: ['reports', filters],
    queryFn: () => fetchReports(filters),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
