'use client';

import { useState } from 'react';
import { useTransactions } from '@/hooks/use-transactions';
import { TransactionFilters } from '@/components/features/transactions/transaction-filters';
import { TransactionTable } from '@/components/features/transactions/transaction-table';
import { CreateTransactionModal } from '@/components/features/transactions/create-transaction-modal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function TransactionsPage() {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    businessIds: [] as string[],
    parentCategoryIds: [] as string[],
    childCategoryIds: [] as string[],
    cardIds: [] as string[],
    transactionTypes: [] as string[],
    statuses: [] as string[],
    uncategorized: false,
    page: 1,
    perPage: 50,
    sortBy: 'bank_charge_date:desc',
  });

  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading, error } = useTransactions(filters);

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 })); // Reset to page 1 on filter change
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">
          Error loading transactions: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
      </div>

      <TransactionFilters filters={filters} onFilterChange={handleFilterChange} />

      <TransactionTable
        transactions={data?.transactions || []}
        isLoading={isLoading}
        total={data?.total || 0}
        page={filters.page}
        perPage={filters.perPage}
        onPageChange={handlePageChange}
      />

      <CreateTransactionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
