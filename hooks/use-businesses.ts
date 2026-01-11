import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Category {
  id: number;
  name: string;
}

interface Business {
  id: number;
  normalized_name: string;
  display_name: string;
  primary_category: Category | null;
  child_category: Category | null;
  categorization_source: string | null;
  approved: boolean;
  transaction_count: number;
  total_spent: number;
  last_used_date: string | null;
}

interface BusinessesResponse {
  total: number;
  businesses: Business[];
}

// NEW: Filter interface for all business filtering options
export interface BusinessFilters {
  search?: string;
  approvedOnly?: boolean;
  sort?: string;
  uncategorized?: boolean;
  parentCategoryIds?: number[];
  childCategoryIds?: number[];
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
}

export function useBusinesses(filters: BusinessFilters = {}, options?: { enabled?: boolean }) {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.approvedOnly !== undefined) params.set('approved_only', filters.approvedOnly.toString());
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.uncategorized) params.set('uncategorized', 'true');

  // NEW: Category params
  if (filters.parentCategoryIds && filters.parentCategoryIds.length > 0) {
    params.set('parent_category_ids', filters.parentCategoryIds.join(','));
  }
  if (filters.childCategoryIds && filters.childCategoryIds.length > 0) {
    params.set('child_category_ids', filters.childCategoryIds.join(','));
  }

  // NEW: Date params
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  return useQuery<BusinessesResponse>({
    queryKey: ['businesses', filters], // Use entire filter object as key
    queryFn: async () => {
      const response = await fetch(`/api/businesses?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch businesses');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

export function useMergeBusinesses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetId,
      businessIds,
    }: {
      targetId: number;
      businessIds: number[];
    }) => {
      const response = await fetch('/api/businesses/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: targetId,
          business_ids: businessIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to merge businesses');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      businessId,
      approved,
      displayName,
      primaryCategoryId,
      childCategoryId,
    }: {
      businessId: number;
      approved?: boolean;
      displayName?: string;
      primaryCategoryId?: number | null;
      childCategoryId?: number | null;
    }) => {
      const body: any = {};
      if (approved !== undefined) body.approved = approved;
      if (displayName) body.display_name = displayName;
      if (primaryCategoryId !== undefined) body.primary_category_id = primaryCategoryId;
      if (childCategoryId !== undefined) body.child_category_id = childCategoryId;

      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update business');
      }

      return response.json();
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['businesses'] });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: ['businesses'] });

      // Optimistically update all matching queries
      queryClient.setQueriesData<BusinessesResponse>({ queryKey: ['businesses'] }, (old) => {
        if (!old) return old;

        return {
          ...old,
          businesses: old.businesses.map((business) =>
            business.id === variables.businessId
              ? {
                  ...business,
                  ...(variables.approved !== undefined && { approved: variables.approved }),
                  ...(variables.displayName && { display_name: variables.displayName }),
                }
              : business
          ),
        };
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      // Refresh to get server state
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// NEW: Bulk update categories for multiple businesses
export function useBulkUpdateCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      businessIds,
      primaryCategoryId,
      childCategoryId,
    }: {
      businessIds: number[];
      primaryCategoryId: number;
      childCategoryId?: number | null;
    }) => {
      const response = await fetch('/api/businesses/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_ids: businessIds,
          primary_category_id: primaryCategoryId,
          child_category_id: childCategoryId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update businesses');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
