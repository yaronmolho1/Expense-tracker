'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/hooks/use-transactions';
import { useInstallmentGroup } from '@/hooks/use-installment-group';
import { InstallmentTimeline } from './installment-timeline';
import { MobileCategoryEditorDialog } from './mobile-category-editor-dialog';
import { MobileStatusEditorDialog } from './mobile-status-editor-dialog';
import { Loader2, Edit, Trash2 } from 'lucide-react';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onEditCategory?: (transaction: Transaction) => void;
  onEditStatus?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  onEditCategory,
  onEditStatus,
  onDelete,
}: TransactionDetailModalProps) {
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);

  const { data: installmentData, isLoading } = useInstallmentGroup(
    transaction?.id || null
  );

  if (!transaction) return null;

  // Detect if mobile
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        {/* Transaction Details */}
        <div className="space-y-5 px-1">
          {/* Business Name */}
          <div className="pb-3 border-b">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Business</div>
            <div className="text-lg sm:text-xl font-semibold">{transaction.business_name}</div>
          </div>

          {/* Mobile-Only Section - Quick Summary */}
          <div className="md:hidden grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg border">
            {/* Category */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Category</div>
              <div className="text-sm font-medium">
                {transaction.category.primary || 'Uncategorized'}
                {transaction.category.child && (
                  <div className="text-xs text-muted-foreground mt-0.5">{transaction.category.child}</div>
                )}
              </div>
            </div>

            {/* Card */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Card</div>
              <div className="text-sm">
                {transaction.card.nickname || `•••• ${transaction.card.last_4}`}
              </div>
            </div>

            {/* Type */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Type</div>
              <div className="text-sm">
                {transaction.installment_info
                  ? `Installment ${transaction.installment_info.index}/${transaction.installment_info.total}`
                  : transaction.transaction_type === 'subscription'
                  ? 'Subscription'
                  : 'One-time'}
              </div>
            </div>

            {/* Status */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
              <div className="text-sm capitalize">{transaction.status}</div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 bg-muted/40 rounded-lg border">
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Amount</div>
              <div className={`text-lg sm:text-xl font-semibold ${transaction.is_refund ? 'text-green-600' : 'text-foreground'}`}>
                {formatCurrency(transaction.is_refund ? -transaction.charged_amount_ils : transaction.charged_amount_ils)}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Deal Date</div>
              <div className="text-base sm:text-lg">{formatDate(transaction.deal_date)}</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Card</div>
              <div className="text-base sm:text-lg">
                {transaction.card.last_4 ? (
                  transaction.card.nickname || `****${transaction.card.last_4}`
                ) : (
                  <span className="text-emerald-600 font-medium">{transaction.card.nickname || 'Cash'}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Status</div>
              <div className="text-base sm:text-lg capitalize">{transaction.status}</div>
            </div>
            {transaction.original_amount && transaction.original_currency !== 'ILS' && (
              <div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Original Amount</div>
                <div className="text-base sm:text-lg">
                  {transaction.is_refund ? '-' : ''}{transaction.original_currency} {transaction.original_amount.toFixed(2)}
                </div>
              </div>
            )}
            {transaction.bank_charge_date && (
              <div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Charge Date</div>
                <div className="text-base sm:text-lg">{formatDate(transaction.bank_charge_date)}</div>
              </div>
            )}
          </div>

          {/* Category Info */}
          <div className="p-4 sm:p-5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5">Category</div>
            <div className="text-base sm:text-lg font-medium">
              {transaction.category.primary}
              {transaction.category.child && (
                <>
                  <br />
                  <span className="text-sm sm:text-base text-muted-foreground font-normal">{transaction.category.child}</span>
                </>
              )}
            </div>
          </div>

          {/* Subscription Info */}
          {transaction.subscription && (
            <div className="p-4 sm:p-5 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900">
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5">Subscription</div>
              <div className="text-base sm:text-lg font-medium">
                {transaction.business_name}
                {transaction.subscription.name && (
                  <>
                    <br />
                    <span className="text-sm sm:text-base text-muted-foreground font-normal">{transaction.subscription.name}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Installment Timeline */}
          {isInstallment && (
            <div className="border-t pt-5">
              <h3 className="text-base sm:text-lg font-semibold mb-4">Installment Timeline</h3>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : installmentData?.installments ? (
                <InstallmentTimeline
                  installments={installmentData.installments}
                  currentTransactionId={transaction.id}
                />
              ) : (
                <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">
                  Unable to load installment timeline
                </div>
              )}
            </div>
          )}

          {/* Refund Badge */}
          {transaction.is_refund && (
            <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
              <div className="text-sm sm:text-base text-green-700 dark:text-green-400 font-medium">✓ This is a refund transaction</div>
            </div>
          )}

          {/* Action Buttons */}
          {(onEditCategory || onEditStatus || onDelete) && (
            <div className="flex flex-col sm:flex-row gap-2 border-t pt-5 mt-5">
              {onEditCategory && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (isMobile) {
                      // On mobile: open nested dialog
                      setCategoryEditorOpen(true);
                    } else {
                      // On desktop: use callback (redirect to table inline editor)
                      onEditCategory(transaction);
                      onClose();
                    }
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Category
                </Button>
              )}
              {onEditStatus && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (isMobile) {
                      // On mobile: open nested dialog
                      setStatusEditorOpen(true);
                    } else {
                      // On desktop: use callback (redirect to table inline editor)
                      onEditStatus(transaction);
                      onClose();
                    }
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Status
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    onDelete(transaction);
                    onClose();
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Mobile Editor Dialogs */}
      <MobileCategoryEditorDialog
        isOpen={categoryEditorOpen}
        onClose={() => setCategoryEditorOpen(false)}
        transaction={transaction}
      />
      <MobileStatusEditorDialog
        isOpen={statusEditorOpen}
        onClose={() => setStatusEditorOpen(false)}
        transaction={transaction}
      />
    </Dialog>
  );
}
