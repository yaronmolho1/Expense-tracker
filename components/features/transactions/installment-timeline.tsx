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
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <div className="text-sm text-gray-500">Total Installments</div>
          <div className="text-2xl font-bold">{installments.length} Payments</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Amount</div>
          <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[13px] top-8 bottom-8 w-0.5 bg-gray-200" />

        {/* Timeline items */}
        <div className="space-y-4">
          {installments.map((installment) => {
            const isCurrent = installment.id === currentTransactionId;
            const isCompleted = installment.status === 'completed';
            const isProjected = installment.status === 'projected';

            return (
              <div
                key={installment.id}
                className={cn(
                  'relative pl-12 pb-4 transition-all',
                  isCurrent && 'scale-105'
                )}
              >
                {/* Icon */}
                <div className="absolute left-0 top-1 z-10 bg-white">
                  {getStatusIcon(installment, isCurrent)}
                </div>

                {/* Content card */}
                <div
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    getStatusColor(installment, isCurrent)
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">
                          Payment {installment.installment_index}/{installment.installment_total}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            Current
                          </span>
                        )}
                        {isCompleted && !isCurrent && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                            Completed
                          </span>
                        )}
                        {isProjected && (
                          <span className="px-2 py-0.5 bg-gray-400 text-white text-xs rounded-full">
                            Projected
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {formatDate(installment.charge_date)}
                      </div>
                      {installment.original_amount && installment.original_currency !== 'ILS' && (
                        <div className="mt-1 text-xs text-gray-500">
                          Original: {installment.original_currency} {installment.original_amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
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
      <div className="flex gap-4 pt-4 border-t text-sm">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          <span className="text-gray-600">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />
          <span className="text-gray-600">Current</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600">Projected</span>
        </div>
      </div>
    </div>
  );
}
