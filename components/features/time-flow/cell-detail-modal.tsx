'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTransactions, Transaction } from '@/hooks/use-transactions';
import { Loader2 } from 'lucide-react';

interface CellDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: number | null;
  subCategoryId: number | null;
  month: string;
  categoryName: string;
  subCategoryName: string;
}

export function CellDetailModal({
  isOpen,
  onClose,
  categoryId,
  subCategoryId,
  month,
  categoryName,
  subCategoryName,
}: CellDetailModalProps) {
  const [year, monthNum] = month.split('-');
  const dateFrom = `${year}-${monthNum}-01`;
  const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
  const dateTo = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

  const { data, isLoading } = useTransactions({
    dateFrom,
    dateTo,
    parentCategoryIds: categoryId && categoryId !== -1 ? [categoryId.toString()] : undefined,
    childCategoryIds: subCategoryId ? [subCategoryId.toString()] : undefined,
    uncategorized: categoryId === -1 ? true : undefined,
    perPage: 100,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="space-y-1">
              <div>{subCategoryName || categoryName}</div>
              <div className="text-sm font-normal text-gray-500">
                {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {data?.transactions && data.transactions.length > 0 ? (
              <>
                <div className="text-sm text-gray-500">
                  {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Business
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Card
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.transactions.map((transaction: Transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.bank_charge_date || transaction.deal_date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {transaction.business_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {transaction.card.last_4 ? (
                              transaction.card.nickname || `****${transaction.card.last_4}`
                            ) : (
                              <span className="text-emerald-600 font-medium">{transaction.card.nickname || 'Cash'}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(transaction.charged_amount_ils)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {transaction.installment_info
                              ? `${transaction.installment_info.index}/${transaction.installment_info.total}`
                              : transaction.transaction_type === 'one_time'
                              ? 'One Time'
                              : transaction.transaction_type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No transactions found for this period.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
