import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// TYPES
// ============================================

export interface Card {
  id: number;
  last4: string | null;
  nickname: string | null;
  bankOrCompany: string | null;
  issuer: string | null;
  fileFormatHandler: string | null;
  isActive: boolean;
  isSystem: boolean;
  type: 'credit' | 'debit' | 'cash';
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateCardInput {
  owner: string;
  last4: string;
  issuer: 'MAX' | 'VISA-CAL' | 'ISRACARD';
  nickname?: string;
  bankOrCompany?: string;
}

export interface UpdateCardInput {
  owner: string;
  nickname?: string | null;
  bankOrCompany?: string | null;
  isActive?: boolean;
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchCards(owner: string): Promise<Card[]> {
  const response = await fetch(`/api/cards?owner=${encodeURIComponent(owner)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch cards');
  }
  const data = await response.json();
  return data.cards;
}

async function createCard(input: CreateCardInput): Promise<Card> {
  const response = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create card');
  }

  const data = await response.json();
  return data.card;
}

async function updateCard(cardId: number, input: UpdateCardInput): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update card');
  }

  const data = await response.json();
  return data.card;
}

async function deleteCard(cardId: number, owner: string, cascade: boolean = false): Promise<{ transactionCount?: number; requiresConfirmation?: boolean }> {
  const url = `/api/cards/${cardId}?owner=${encodeURIComponent(owner)}${cascade ? '&cascade=true' : ''}`;
  const response = await fetch(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.requiresConfirmation) {
      return { transactionCount: error.transactionCount, requiresConfirmation: true };
    }
    throw new Error(error.error || 'Failed to delete card');
  }

  return {};
}

// ============================================
// HOOKS
// ============================================

export function useCards(owner: string) {
  return useQuery({
    queryKey: ['cards', owner],
    queryFn: () => fetchCards(owner),
    enabled: !!owner,
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: number; input: UpdateCardInput }) =>
      updateCard(cardId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, owner, cascade }: { cardId: number; owner: string; cascade?: boolean }) =>
      deleteCard(cardId, owner, cascade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}
