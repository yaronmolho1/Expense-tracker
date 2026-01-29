import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  cardIds?: string[];
  categoryIds?: number[];
  businessIds?: string[];
  parentCategoryIds?: string[];
  childCategoryIds?: string[];
  transactionTypes?: string[];
  statuses?: string[];
  amountMin?: number;
  amountMax?: number;
  search?: string;
  uncategorized?: boolean;
  page?: number;
  perPage?: number;
  sortBy?: string;
}

export interface Transaction {
  id: number;
  business_id: number;
  business_name: string;
  deal_date: string;
  bank_charge_date: string | null;
  charged_amount_ils: number;
  original_amount: number | null;
  original_currency: string;
  category: {
    primary: string | null;
    child: string | null;
  };
  card: {
    last_4: string;
    nickname: string | null;
  };
  transaction_type: string;
  status: 'completed' | 'projected' | 'cancelled';
  installment_info: {
    index: number;
    total: number;
    group_id: string;
  } | null;
  is_refund: boolean;
  subscription: {
    id: number;
    name: string | null;
  } | null;
}

export interface TransactionListResponse {
  total: number;
  page: number;
  per_page: number;
  transactions: Transaction[];
}

async function fetchTransactions(filters: TransactionFilters): Promise<TransactionListResponse> {
  const params = new URLSearchParams();

  // Add filters to query string
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.cardIds?.length) params.set('card_ids', filters.cardIds.join(','));
  if (filters.categoryIds?.length) params.set('category_ids', filters.categoryIds.join(','));
  if (filters.businessIds?.length) params.set('business_ids', filters.businessIds.join(','));
  if (filters.parentCategoryIds?.length) params.set('parent_category_ids', filters.parentCategoryIds.join(','));
  if (filters.childCategoryIds?.length) params.set('child_category_ids', filters.childCategoryIds.join(','));
  if (filters.transactionTypes?.length) params.set('transaction_types', filters.transactionTypes.join(','));
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.amountMin !== undefined) params.set('amount_min', filters.amountMin.toString());
  if (filters.amountMax !== undefined) params.set('amount_max', filters.amountMax.toString());
  if (filters.search) params.set('search', filters.search);
  if (filters.uncategorized) params.set('uncategorized', 'true');
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.perPage) params.set('per_page', filters.perPage.toString());
  if (filters.sortBy) params.set('sort', filters.sortBy);

  const response = await fetch(`/api/transactions?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch transactions');
  }

  return response.json();
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 5000, // 5 seconds
    gcTime: 300000, // 5 minutes (formerly cacheTime)
  });
}

export function useUpdateTransactionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      status,
    }: {
      transactionId: number;
      status: 'completed' | 'projected' | 'cancelled';
    }) => {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update transaction status');
      }

      return response.json();
    },
    onMutate: async ({ transactionId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: ['transactions'] });

      // Optimistically update all matching queries
      queryClient.setQueriesData<TransactionListResponse>({ queryKey: ['transactions'] }, (old) => {
        if (!old) return old;

        return {
          ...old,
          transactions: old.transactions.map((transaction) =>
            transaction.id === transactionId
              ? { ...transaction, status }
              : transaction
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['time-flow'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, deleteAll }: { transactionId: number; deleteAll?: boolean }) => {
      const url = deleteAll
        ? `/api/transactions/${transactionId}?deleteAll=true`
        : `/api/transactions/${transactionId}`;

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete transaction');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch transactions
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['time-flow'] });
    },
  });
}

export interface CreateTransactionPayload {
  businessId?: number;
  businessName?: string;
  cardId: number;
  dealDate: string;
  amount: number;
  currency: string;
  paymentType?: 'one_time' | 'installments';
  installmentIndex?: number;
  installmentTotal?: number;
  installmentAmount?: number;
  primaryCategoryId?: number;
  childCategoryId?: number;
  notes?: string;
  isRefund?: boolean;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTransactionPayload) => {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create transaction');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['time-flow'] });
    },
  });
}
