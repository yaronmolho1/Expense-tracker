import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Subscription {
  id: number;
  name: string | null;
  businessName: string;
  businessId: number;
  cardLast4: string;
  cardNickname: string | null;
  cardId: number;
  amount: string;
  frequency: 'monthly' | 'annual';
  startDate: string;
  endDate: string | null;
  status: 'active' | 'cancelled' | 'ended';
  createdFromSuggestion: boolean;
  createdAt: string;
  cancelledAt: string | null;
  notes: string | null;
}

export interface SubscriptionSuggestion {
  id: number;
  businessName: string;
  cardId: number;
  cardLast4: string;
  cardNickname: string | null;
  detectedAmount: string;
  frequency: 'monthly' | 'annual';
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  detectionReason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'ignored';
  createdAt: string;
  resolvedAt: string | null;
}

// Fetch subscriptions
export function useSubscriptions(status?: 'active' | 'cancelled' | 'ended') {
  return useQuery({
    queryKey: ['subscriptions', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await fetch(`/api/subscriptions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch subscriptions');

      const data = await response.json();
      return data.subscriptions as Subscription[];
    },
  });
}

// Fetch subscription suggestions
export function useSubscriptionSuggestions(status?: 'pending' | 'approved' | 'rejected' | 'ignored') {
  return useQuery({
    queryKey: ['subscription-suggestions', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await fetch(`/api/subscriptions/suggestions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch subscription suggestions');

      const data = await response.json();
      return data.suggestions as SubscriptionSuggestion[];
    },
  });
}

// Create subscription
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      businessId: number;
      businessName?: string;
      cardId: number;
      amount: number;
      currency: 'ILS' | 'USD' | 'EUR';
      frequency: 'monthly' | 'annual';
      startDate: string;
      endDate?: string;
      primaryCategoryId?: number;
      childCategoryId?: number;
      notes?: string;
      backfillTransactionIds?: number[];
    }) => {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

// Update subscription
export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        status?: 'active' | 'cancelled' | 'ended';
        endDate?: string;
        amount?: number;
        notes?: string;
      };
    }) => {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update subscription');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

// Cancel subscription
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, effectiveDate }: { id: number; effectiveDate: string }) => {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectiveDate }),
      });

      if (!response.ok) throw new Error('Failed to cancel subscription');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

// Approve suggestion
export function useApproveSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      adjustedAmount,
      startDate,
      endDate,
    }: {
      id: number;
      adjustedAmount?: number;
      startDate?: string;
      endDate?: string;
    }) => {
      const response = await fetch(`/api/subscriptions/suggestions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustedAmount, startDate, endDate }),
      });

      if (!response.ok) throw new Error('Failed to approve suggestion');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

// Reject suggestion
export function useRejectSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/subscriptions/suggestions/${id}/reject`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reject suggestion');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-suggestions'] });
    },
  });
}
