'use client';

import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type InstallmentStrategy = 'delete_matching' | 'delete_all' | 'skip';

type PartialInstallment = {
  groupId: string;
  businessName: string;
  inBatch: number;
  total: number;
  allPayments: Array<{
    index: number;
    amount: number;
    dealDate: string;
    status: 'completed' | 'projected' | 'cancelled';
    inThisBatch: boolean;
  }>;
};

interface BatchDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  warnings: {
    batchInfo?: Array<{
      id: number;
      fileCount: number;
      totalTransactions: number;
    }>;
    summary?: {
      totalInRange: number;
      oneTimeCount: number;
      installmentCount: number;
      subscriptionCount: number;
    };
    oneTimeTransactions?: number;
    partialInstallments: PartialInstallment[];
  };
  strategy: InstallmentStrategy;
  onStrategyChange: (strategy: InstallmentStrategy) => void;
  onConfirm: () => void;
  confirmButtonText?: string;
}

export function BatchDeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  warnings,
  strategy,
  onStrategyChange,
  onConfirm,
  confirmButtonText = 'Delete',
}: BatchDeleteConfirmDialogProps) {
  const calculateTotalInstallments = () => {
    return warnings.partialInstallments.reduce((sum, group) => sum + group.total, 0);
  };

  // Handle both single batch (object) and multi-batch (array) formats
  const batchInfoArray = warnings.batchInfo
    ? (Array.isArray(warnings.batchInfo) ? warnings.batchInfo : [warnings.batchInfo])
    : [];

  const totalTransactions = batchInfoArray.length > 0
    ? batchInfoArray.reduce((sum, b) => sum + b.totalTransactions, 0)
    : warnings.summary?.totalInRange || 0;

  const totalBatches = batchInfoArray.length || 0;
  const totalFiles = batchInfoArray.reduce((sum, b) => sum + b.fileCount, 0) || 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* Summary */}
              {warnings.batchInfo ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Batches</div>
                    <div className="text-lg font-semibold">{totalBatches}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Files</div>
                    <div className="text-lg font-semibold">{totalFiles}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Transactions</div>
                    <div className="text-lg font-semibold">{totalTransactions}</div>
                  </div>
                </div>
              ) : warnings.summary ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Total Transactions</div>
                    <div className="text-lg font-semibold">{warnings.summary.totalInRange}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Breakdown</div>
                    <div className="text-xs space-y-0.5">
                      <div>{warnings.summary.oneTimeCount} one-time</div>
                      <div>{warnings.summary.installmentCount} installments</div>
                      {warnings.summary.subscriptionCount > 0 && (
                        <div>{warnings.summary.subscriptionCount} subscriptions</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Installment warnings */}
              {warnings.partialInstallments.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-orange-900">
                        Partial Installment Plans Detected
                      </h4>
                      <p className="text-sm text-orange-800 mt-1">
                        {warnings.partialInstallments.length} installment plan(s) would be affected:
                      </p>
                    </div>
                  </div>

                  {/* Installment list */}
                  <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                    {warnings.partialInstallments.map((group, i) => (
                      <div key={i} className="bg-white rounded-lg p-3">
                        <div className="font-medium text-sm mb-2">{group.businessName}</div>
                        <div className="text-xs text-muted-foreground mb-3">
                          {group.inBatch} of {group.total} payment(s) in selected range
                        </div>

                        {/* Visual timeline */}
                        <div className="flex gap-1">
                          {group.allPayments.map((payment, j) => (
                            <div
                              key={j}
                              className={cn(
                                'flex-1 h-10 rounded flex flex-col items-center justify-center text-xs',
                                payment.inThisBatch || payment.inThisBatch === undefined
                                  ? 'bg-red-500 text-white'
                                  : payment.status === 'completed'
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-gray-200 text-gray-600'
                              )}
                              title={`Payment ${payment.index}: ${payment.amount} ILS on ${payment.dealDate}`}
                            >
                              <div className="font-semibold">{payment.index}</div>
                              <div className="text-[10px]">{payment.status[0].toUpperCase()}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <span>In selection</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-200 rounded"></div>
                            <span>Completed (other)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gray-200 rounded"></div>
                            <span>Projected</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strategy selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">How to handle installments?</Label>
                    <RadioGroup value={strategy} onValueChange={onStrategyChange}>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="delete_matching" id="matching" />
                        <Label htmlFor="matching" className="text-sm cursor-pointer">
                          <div className="font-medium">Delete only transactions in selection</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            May leave some installment payments orphaned
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="delete_all" id="all" />
                        <Label htmlFor="all" className="text-sm cursor-pointer">
                          <div className="font-medium">Delete entire installment plans</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Removes all {calculateTotalInstallments()} payments (including outside selection)
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="skip" id="skip" />
                        <Label htmlFor="skip" className="text-sm cursor-pointer">
                          <div className="font-medium">Skip all installment plans</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Only delete {warnings.oneTimeTransactions || warnings.summary?.oneTimeCount || 0} one-time transactions
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              <div className="text-sm text-destructive font-semibold">
                This action cannot be undone.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90"
          >
            {confirmButtonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
