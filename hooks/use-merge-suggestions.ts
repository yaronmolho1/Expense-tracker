import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Business {
  id: number;
  name: string;
  normalized_name: string;
  primary_category_id: number | null;
  child_category_id: number | null;
}

interface MergeSuggestion {
  id: number;
  business_1: Business;
  business_2: Business;
  similarity_score: string;
  reason: string | null;
  created_at: Date;
}

export function useMergeSuggestions() {
  return useQuery<{ suggestions: MergeSuggestion[] }>({
    queryKey: ['merge-suggestions'],
    queryFn: async () => {
      const response = await fetch('/api/suggestions/business-merges');
      if (!response.ok) {
        throw new Error('Failed to fetch merge suggestions');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useApproveMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      suggestionId,
      targetId,
    }: {
      suggestionId: number;
      targetId: number;
    }) => {
      const response = await fetch(
        `/api/suggestions/business-merges/${suggestionId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve merge');
      }

      return response.json();
    },
    onSuccess: () => {
      // Refresh suggestions list and businesses list
      queryClient.invalidateQueries({ queryKey: ['merge-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRejectMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: number) => {
      const response = await fetch(
        `/api/suggestions/business-merges/${suggestionId}/reject`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject merge');
      }

      return response.json();
    },
    onSuccess: () => {
      // Refresh suggestions list
      queryClient.invalidateQueries({ queryKey: ['merge-suggestions'] });
    },
  });
}
