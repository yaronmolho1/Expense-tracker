'use client';

import { InstallmentPayment } from '@/hooks/use-installment-group';
import { Check, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstallmentTimelineProps {
  installments: InstallmentPayment[];
  currentTransactionId: number;
}

export function InstallmentTimeline({ installments, currentTransactionId }: InstallmentTimelineProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Find the first non-completed payment as the current one
  const currentPaymentId = installments.find(inst => inst.status !== 'completed')?.id || currentTransactionId;

  const getStatusIcon = (installment: InstallmentPayment, isCurrent: boolean) => {
    if (isCurrent) {
      return <Circle className="h-5 w-5 fill-blue-500 text-blue-500" />;
    }
    if (installment.status === 'completed') {
      return <Check className="h-5 w-5 text-green-500" />;
    }
    return <Clock className="h-5 w-5 text-gray-400" />;
  };

  const getStatusColor = (installment: InstallmentPayment, isCurrent: boolean) => {
    if (isCurrent) return 'border-blue-500 bg-blue-50';
    if (installment.status === 'completed') return 'border-green-500 bg-green-50';
    return 'border-gray-300 bg-gray-50';
  };

  const totalAmount = installments.reduce((sum, inst) => sum + inst.charged_amount_ils, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b">
        <div>
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Installments</div>
          <div className="text-xl sm:text-2xl font-bold">{installments.length} Payments</div>
        </div>
        <div className="sm:text-right">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Amount</div>
          <div className="text-xl sm:text-2xl font-bold">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[10px] sm:left-[13px] top-8 bottom-8 w-0.5 bg-border" />

        {/* Timeline items */}
        <div className="space-y-3 sm:space-y-4">
          {installments.map((installment) => {
            const isCurrent = installment.id === currentPaymentId;
            const isCompleted = installment.status === 'completed';
            const isProjected = installment.status === 'projected';

            return (
              <div
                key={installment.id}
                className={cn(
                  'relative pl-8 sm:pl-12 pb-3 sm:pb-4 transition-all',
                  isCurrent && 'sm:scale-105'
                )}
              >
                {/* Icon */}
                <div className="absolute left-0 top-1 z-10 bg-background">
                  {getStatusIcon(installment, isCurrent)}
                </div>

                {/* Content card */}
                <div
                  className={cn(
                    'p-3 sm:p-4 rounded-lg border transition-all',
                    getStatusColor(installment, isCurrent)
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base sm:text-lg">
                          Payment {installment.installment_index}/{installment.installment_total}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full whitespace-nowrap">
                            Current
                          </span>
                        )}
                        {isCompleted && !isCurrent && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full whitespace-nowrap">
                            Completed
                          </span>
                        )}
                        {isProjected && (
                          <span className="px-2 py-0.5 bg-gray-400 text-white text-xs rounded-full whitespace-nowrap">
                            Projected
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        {formatDate(installment.charge_date)}
                      </div>
                      {installment.original_amount && installment.original_currency !== 'ILS' && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Original: {installment.original_currency} {installment.original_amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <div className="text-lg sm:text-xl font-bold">
                        {formatCurrency(installment.charged_amount_ils)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:gap-4 pt-4 border-t text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
          <span className="text-muted-foreground">Completed</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-blue-500 text-blue-500" />
          <span className="text-muted-foreground">Current</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Projected</span>
        </div>
      </div>
    </div>
  );
}
