import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface MergedBusiness {
  id: number;
  normalized_name: string;
  display_name: string;
  merged_to_id: number;
  created_at: string;
  merged_at: string;
  target_business_name: string;
  target_normalized_name: string;
  target_transaction_count: number;
  original_transaction_count: number;
}

interface MergedBusinessesResponse {
  total: number;
  merged_businesses: MergedBusiness[];
}

export function useMergedBusinesses() {
  return useQuery<MergedBusinessesResponse>({
    queryKey: ['merged-businesses'],
    queryFn: async () => {
      const response = await fetch('/api/businesses/merged');
      if (!response.ok) {
        throw new Error('Failed to fetch merged businesses');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useUnmergeBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId: number) => {
      const response = await fetch(`/api/businesses/${businessId}/unmerge`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unmerge business');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['merged-businesses'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}
