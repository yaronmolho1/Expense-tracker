'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { type Transaction, useDeleteTransaction } from '@/hooks/use-transactions';
import { TransactionDetailModal } from './transaction-detail-modal';
import { InlineCategoryEditor } from './inline-category-editor';
import { InlineStatusEditor } from './inline-status-editor';
import { toast } from 'sonner';

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  sortBy?: string;
  onSortChange?: (sortBy: string) => void;
}

export function TransactionTable({
  transactions,
  isLoading,
  total,
  page,
  perPage,
  onPageChange,
  sortBy = 'bank_charge_date:desc',
  onSortChange,
}: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const deleteTransaction = useDeleteTransaction();
  const totalPages = Math.ceil(total / perPage);

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    try {
      const result = await deleteTransaction.mutateAsync({
        transactionId: transactionToDelete.id,
        deleteAll,
      });

      // Show success message
      if (result.deletedCount > 1) {
        toast.success(`Successfully deleted ${result.deletedCount} transactions`);
      } else {
        toast.success('Transaction deleted successfully');
      }

      setTransactionToDelete(null);
      setDeleteAll(false);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      completed: 'default',
      projected: 'secondary',
      cancelled: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status}
      </Badge>
    );
  };

  const handleRowClick = (transaction: Transaction) => {
    // Only open modal for installments and subscriptions
    if (transaction.installment_info || transaction.transaction_type === 'subscription') {
      setSelectedTransaction(transaction);
    }
  };

  // Parse current sort state
  const [currentSortField, currentSortDirection] = sortBy.split(':') as [string, 'asc' | 'desc'];

  // Handle column header click for sorting
  const handleSort = (field: string) => {
    if (!onSortChange) return;

    if (currentSortField === field) {
      // Toggle direction if same field
      const newDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      onSortChange(`${field}:${newDirection}`);
    } else {
      // Default direction for new field
      const defaultDirection = field === 'business_name' ? 'asc' : 'desc';
      onSortChange(`${field}:${defaultDirection}`);
    }
  };

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
    const isActive = currentSortField === field;
    const isAsc = currentSortDirection === 'asc';

    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            isAsc ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-30" />
          )}
        </div>
      </TableHead>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading transactions...</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">No transactions found</div>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <SortableHeader field="bank_charge_date">Date</SortableHeader>
              <SortableHeader field="business_name">Business</SortableHeader>
              <TableHead>Category</TableHead>
              <TableHead>Card</TableHead>
              <SortableHeader field="charged_amount_ils" className="text-right">Amount</SortableHeader>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const hasDetails = transaction.installment_info || transaction.transaction_type === 'subscription';

              return (
                <TableRow
                  key={transaction.id}
                  className={hasDetails ? 'cursor-pointer hover:bg-gray-50' : ''}
                  onClick={() => hasDetails && handleRowClick(transaction)}
                >
                  <TableCell>
                    {hasDetails && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(transaction);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDate(transaction.bank_charge_date || transaction.deal_date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.business_name}
                    {transaction.is_refund && (
                      <Badge variant="outline" className="ml-2">
                        Refund
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <InlineCategoryEditor
                      businessId={transaction.business_id}
                      businessName={transaction.business_name}
                      currentPrimaryCategory={transaction.category.primary}
                      currentChildCategory={transaction.category.child}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {transaction.card.nickname || `•••• ${transaction.card.last_4}`}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={transaction.is_refund ? 'text-green-600' : ''}>
                      {formatCurrency(transaction.is_refund ? -transaction.charged_amount_ils : transaction.charged_amount_ils)}
                    </span>
                    {transaction.original_currency !== 'ILS' && (
                      <div className="text-xs text-muted-foreground">
                        {transaction.is_refund ? '-' : ''}{transaction.original_amount} {transaction.original_currency}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {transaction.installment_info ? (
                      <Badge variant="secondary">
                        {transaction.installment_info.index}/{transaction.installment_info.total}
                      </Badge>
                    ) : transaction.transaction_type === 'subscription' ? (
                      <Badge variant="secondary">Subscription</Badge>
                    ) : (
                      <span className="text-muted-foreground">One-time</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <InlineStatusEditor
                      transactionId={transaction.id}
                      currentStatus={transaction.status as 'completed' | 'projected' | 'cancelled'}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setTransactionToDelete(transaction)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          Showing {(page - 1) * perPage + 1} to{' '}
          {Math.min(page * perPage, total)} of {total} transactions
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => {
        if (!open) {
          setTransactionToDelete(null);
          setDeleteAll(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">This will permanently delete this transaction:</p>
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <div className="font-medium">{transactionToDelete?.business_name}</div>
                  <div className="text-sm">
                    {transactionToDelete && formatCurrency(transactionToDelete.charged_amount_ils)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {transactionToDelete && formatDate(transactionToDelete.deal_date)}
                  </div>
                </div>

                {/* Installment warning and option */}
                {transactionToDelete?.installment_info && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium text-orange-600">
                      This is payment {transactionToDelete.installment_info.index} of {transactionToDelete.installment_info.total} in an installment plan.
                    </div>
                    <label className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={deleteAll}
                        onChange={(e) => setDeleteAll(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Delete all {transactionToDelete.installment_info.total} payments in this installment plan</span>
                    </label>
                  </div>
                )}

                {/* Subscription warning and option */}
                {transactionToDelete?.transaction_type === 'subscription' && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium text-orange-600">
                      This is a subscription payment.
                    </div>
                    <label className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={deleteAll}
                        onChange={(e) => setDeleteAll(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Delete all transactions in this subscription</span>
                    </label>
                  </div>
                )}

                <div className="mt-3 text-sm text-destructive">
                  This action cannot be undone.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAll ? 'Delete All' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
