'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Transaction } from '@/hooks/use-transactions';
import { useInstallmentGroup } from '@/hooks/use-installment-group';
import { InstallmentTimeline } from './installment-timeline';
import { Loader2 } from 'lucide-react';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailModalProps) {
  const { data: installmentData, isLoading } = useInstallmentGroup(
    transaction?.id || null
  );

  if (!transaction) return null;

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
      month: 'long',
      day: 'numeric',
    });
  };

  const isInstallment = !!transaction.installment_info;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {transaction.business_name}
          </DialogTitle>
        </DialogHeader>

        {/* Transaction Details */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-500">Amount</div>
              <div className={`text-xl font-bold ${transaction.is_refund ? 'text-green-600' : ''}`}>
                {formatCurrency(transaction.is_refund ? -transaction.charged_amount_ils : transaction.charged_amount_ils)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Deal Date</div>
              <div className="text-lg">{formatDate(transaction.deal_date)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Card</div>
              <div className="text-lg">
                {transaction.card.nickname || `****${transaction.card.last_4}`}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="text-lg capitalize">{transaction.status}</div>
            </div>
            {transaction.original_amount && transaction.original_currency !== 'ILS' && (
              <div>
                <div className="text-sm text-gray-500">Original Amount</div>
                <div className="text-lg">
                  {transaction.is_refund ? '-' : ''}{transaction.original_currency} {transaction.original_amount.toFixed(2)}
                </div>
              </div>
            )}
            {transaction.bank_charge_date && (
              <div>
                <div className="text-sm text-gray-500">Charge Date</div>
                <div className="text-lg">{formatDate(transaction.bank_charge_date)}</div>
              </div>
            )}
          </div>

          {/* Category Info */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Category</div>
            <div className="text-lg">
              {transaction.category.primary}
              {transaction.category.child && (
                <>
                  <br />
                  <span className="text-gray-500">{transaction.category.child}</span>
                </>
              )}
            </div>
          </div>

          {/* Subscription Info */}
          {transaction.subscription && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Subscription</div>
              <div className="text-lg">
                {transaction.business_name}
                {transaction.subscription.name && (
                  <>
                    <br />
                    <span className="text-gray-600">{transaction.subscription.name}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Installment Timeline */}
          {isInstallment && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Installment Timeline</h3>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : installmentData?.installments ? (
                <InstallmentTimeline
                  installments={installmentData.installments}
                  currentTransactionId={transaction.id}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Unable to load installment timeline
                </div>
              )}
            </div>
          )}

          {/* Refund Badge */}
          {transaction.is_refund && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700 font-medium">✓ This is a refund transaction</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
