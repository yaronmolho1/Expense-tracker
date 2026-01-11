import { useQuery } from '@tanstack/react-query';

export interface InstallmentPayment {
  id: number;
  deal_date: string;
  charge_date: string;
  charged_amount_ils: number;
  original_amount: number | null;
  original_currency: string;
  status: string;
  installment_index: number;
  installment_total: number;
  installment_group_id: string;
}

export interface InstallmentGroupResponse {
  installments: InstallmentPayment[];
}

async function fetchInstallmentGroup(transactionId: number): Promise<InstallmentGroupResponse> {
  const response = await fetch(`/api/transactions/${transactionId}/installments`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch installment group');
  }

  return response.json();
}

export function useInstallmentGroup(transactionId: number | null) {
  return useQuery({
    queryKey: ['installment-group', transactionId],
    queryFn: () => fetchInstallmentGroup(transactionId!),
    enabled: !!transactionId,
    staleTime: 60000,
  });
}
