'use client';

import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type InstallmentStrategy = 'delete_all_matching_groups' | 'delete_matching_only' | 'skip_all';
type SubscriptionStrategy = 'skip' | 'delete_in_range_and_cancel';

interface PartialInstallment {
  groupId: string;
  businessName: string;
  inBatch: number;
  total: number;
  allPayments: Array<{
    index: number;
    dealDate: string;
    amount: number;
    status: 'completed' | 'projected' | 'cancelled';
    inThisBatch: boolean;
  }>;
}

interface AffectedSubscription {
  id: number;
  name: string;
  businessName: string;
  transactionsInRange: number;
  earliestDate: string;
  latestDate: string;
  continuesAfterRange: boolean;
  frequency: string;
  status: string;
}

interface EnhancedDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warnings: {
    summary: {
      totalInRange: number;
      oneTimeCount: number;
      installmentCount: number;
      installmentGroupsCount: number;
      subscriptionCount: number;
      subscriptionsAffected: number;
    };
    partialInstallments: PartialInstallment[];
    affectedSubscriptions: AffectedSubscription[];
  };

  includeOneTime: boolean;
  includeInstallments: boolean;
  includeSubscriptions: boolean;
  onIncludeOneTimeChange: (value: boolean) => void;
  onIncludeInstallmentsChange: (value: boolean) => void;
  onIncludeSubscriptionsChange: (value: boolean) => void;

  installmentStrategy: InstallmentStrategy;
  onInstallmentStrategyChange: (strategy: InstallmentStrategy) => void;
  subscriptionStrategy: SubscriptionStrategy;
  onSubscriptionStrategyChange: (strategy: SubscriptionStrategy) => void;

  onConfirm: () => void;
}

export function EnhancedDeleteConfirmDialog(props: EnhancedDeleteConfirmDialogProps) {
  const { warnings, includeOneTime, includeInstallments, includeSubscriptions } = props;

  // Calculate selected count based on strategies
  const calculateInstallmentCount = () => {
    if (!includeInstallments || props.installmentStrategy === 'skip_all') return 0;

    if (props.installmentStrategy === 'delete_all_matching_groups') {
      // Count all payments in affected groups (including both partial and complete groups)
      // If we have partial installments data, sum their totals
      // Otherwise, fall back to the installment count in range
      if (warnings.partialInstallments && warnings.partialInstallments.length > 0) {
        return warnings.partialInstallments.reduce((sum, group) => sum + group.total, 0);
      }
      // For complete groups (all payments in range), use the in-range count
      return warnings.summary.installmentCount;
    } else if (props.installmentStrategy === 'delete_matching_only') {
      return warnings.summary.installmentCount;
    }
    return 0;
  };

  const calculateSubscriptionCount = () => {
    if (!includeSubscriptions || props.subscriptionStrategy === 'skip') return 0;
    // Always use the subscription count from summary when deleting
    return warnings.summary.subscriptionCount;
  };

  const selectedCount =
    (includeOneTime ? warnings.summary.oneTimeCount : 0) +
    calculateInstallmentCount() +
    calculateSubscriptionCount();

  // Check if any category is actually selected for deletion (not just checked but with a valid strategy)
  const hasValidSelection =
    includeOneTime ||
    (includeInstallments && props.installmentStrategy !== 'skip_all') ||
    (includeSubscriptions && props.subscriptionStrategy !== 'skip');

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {selectedCount} {selectedCount === 1 ? 'Transaction' : 'Transactions'}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded">
                  <div className="text-xs text-muted-foreground">Found</div>
                  <div className="text-lg font-semibold">{warnings.summary.totalInRange}</div>
                </div>
                <div className={cn("p-3 rounded", includeOneTime ? "bg-blue-50 border border-blue-200" : "bg-muted")}>
                  <div className="text-xs text-muted-foreground">One-time</div>
                  <div className="text-lg font-semibold">{warnings.summary.oneTimeCount}</div>
                </div>
                <div className={cn("p-3 rounded", includeInstallments ? "bg-blue-50 border border-blue-200" : "bg-muted")}>
                  <div className="text-xs text-muted-foreground">Installments</div>
                  <div className="text-lg font-semibold">
                    {warnings.summary.installmentCount} <span className="text-xs text-muted-foreground">({warnings.summary.installmentGroupsCount} plans)</span>
                  </div>
                </div>
                <div className={cn("p-3 rounded", includeSubscriptions ? "bg-blue-50 border border-blue-200" : "bg-muted")}>
                  <div className="text-xs text-muted-foreground">Subscriptions</div>
                  <div className="text-lg font-semibold">
                    {warnings.summary.subscriptionCount} <span className="text-xs text-muted-foreground">({warnings.summary.subscriptionsAffected} active)</span>
                  </div>
                </div>
              </div>

              {/* Selection Checkboxes */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-sm">Choose what to delete:</h4>

                {/* One-time */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="include-onetime"
                    checked={includeOneTime}
                    onCheckedChange={props.onIncludeOneTimeChange}
                    className="mt-1 border-2"
                  />
                  <div className="flex-1">
                    <Label htmlFor="include-onetime" className="cursor-pointer text-sm font-medium">
                      {warnings.summary.oneTimeCount} one-time {warnings.summary.oneTimeCount === 1 ? 'transaction' : 'transactions'}
                    </Label>
                  </div>
                </div>

                {/* Installments */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="include-installments"
                    checked={includeInstallments}
                    onCheckedChange={props.onIncludeInstallmentsChange}
                    className="mt-1 border-2"
                  />
                  <div className="flex-1">
                    <Label htmlFor="include-installments" className="cursor-pointer text-sm font-medium">
                      {warnings.summary.installmentCount} installment {warnings.summary.installmentCount === 1 ? 'payment' : 'payments'} across {warnings.summary.installmentGroupsCount} {warnings.summary.installmentGroupsCount === 1 ? 'plan' : 'plans'}
                    </Label>

                    {includeInstallments && (
                      <RadioGroup
                        value={props.installmentStrategy}
                        onValueChange={props.onInstallmentStrategyChange}
                        className="mt-3 ml-6 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="delete_all_matching_groups" id="inst-all" />
                          <Label htmlFor="inst-all" className="cursor-pointer text-sm">
                            <div className="font-medium">
                              Delete complete payment plans (recommended)
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Removes all payments from affected plans
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="delete_matching_only" id="inst-match" />
                          <Label htmlFor="inst-match" className="cursor-pointer text-sm">
                            <div className="font-medium">
                              Only payments in date range
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Leaves incomplete plans
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="skip_all" id="inst-skip" />
                          <Label htmlFor="inst-skip" className="cursor-pointer text-sm">
                            <div className="font-medium">
                              Keep all installments
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                </div>

                {/* Subscriptions */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="include-subscriptions"
                    checked={includeSubscriptions}
                    onCheckedChange={props.onIncludeSubscriptionsChange}
                    className="mt-1 border-2"
                  />
                  <div className="flex-1">
                    <Label htmlFor="include-subscriptions" className="cursor-pointer text-sm font-medium">
                      {warnings.summary.subscriptionCount} subscription {warnings.summary.subscriptionCount === 1 ? 'payment' : 'payments'} from {warnings.summary.subscriptionsAffected} {warnings.summary.subscriptionsAffected === 1 ? 'subscription' : 'subscriptions'}
                    </Label>

                    {includeSubscriptions && (
                      <RadioGroup
                        value={props.subscriptionStrategy}
                        onValueChange={props.onSubscriptionStrategyChange}
                        className="mt-3 ml-6 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="skip" id="sub-skip" />
                          <Label htmlFor="sub-skip" className="cursor-pointer text-sm">
                            <div className="font-medium">
                              Keep subscriptions (recommended)
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Preserves all subscription data
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="delete_in_range_and_cancel" id="sub-delete" />
                          <Label htmlFor="sub-delete" className="cursor-pointer text-sm">
                            <div className="font-medium">
                              Delete and cancel subscriptions
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Cancels {warnings.summary.subscriptionsAffected} {warnings.summary.subscriptionsAffected === 1 ? 'subscription' : 'subscriptions'}
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                </div>
              </div>

              {/* Warnings Section */}
              {warnings.partialInstallments && warnings.partialInstallments.length > 0 && includeInstallments && (
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Partial Installment Groups
                  </AlertTitle>
                  <AlertDescription>
                    <p className="text-sm mb-3">
                      {warnings.partialInstallments.length} payment {warnings.partialInstallments.length === 1 ? 'plan has' : 'plans have'} payments outside your selected range:
                    </p>

                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {warnings.partialInstallments.map((group, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 border">
                          <div className="font-medium text-sm mb-2">{group.businessName}</div>
                          <div className="text-xs text-muted-foreground mb-3">
                            {group.inBatch} of {group.total} payment(s) in selected range
                          </div>

                          {/* Visual timeline */}
                          <div className="flex gap-1 mb-2">
                            {group.allPayments.map((payment, j) => (
                              <div
                                key={j}
                                className={cn(
                                  "flex-1 h-10 rounded flex flex-col items-center justify-center text-xs",
                                  payment.inThisBatch
                                    ? "bg-red-500 text-white"
                                    : payment.status === 'completed'
                                    ? "bg-green-200 text-green-800"
                                    : "bg-gray-200 text-gray-600"
                                )}
                                title={`Payment ${payment.index}: ${payment.amount} ILS on ${payment.dealDate}`}
                              >
                                <div className="font-semibold">{payment.index}</div>
                                <div className="text-[10px]">{payment.status[0].toUpperCase()}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-red-500 rounded"></div>
                              <span>In range</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-green-200 rounded"></div>
                              <span>Completed</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-gray-200 rounded"></div>
                              <span>Projected</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {warnings.affectedSubscriptions && warnings.affectedSubscriptions.length > 0 && includeSubscriptions && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Affected Subscriptions
                  </AlertTitle>
                  <AlertDescription>
                    <p className="text-sm mb-3">
                      {warnings.affectedSubscriptions.length} {warnings.affectedSubscriptions.length === 1 ? 'subscription' : 'subscriptions'} will be affected:
                    </p>

                    <div className="space-y-2">
                      {warnings.affectedSubscriptions.map((sub, i) => (
                        <div key={i} className="p-3 bg-white rounded border">
                          <div className="font-medium text-sm">{sub.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sub.transactionsInRange} transaction(s) in range
                            {sub.continuesAfterRange && ' • Continues after range'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(sub.earliestDate).toLocaleDateString()} to {new Date(sub.latestDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Final Warning */}
              <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
                <p className="text-sm font-semibold text-destructive">
                  This can't be undone
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCount} {selectedCount === 1 ? 'transaction' : 'transactions'} will be permanently deleted
                  {props.subscriptionStrategy === 'delete_in_range_and_cancel' &&
                    ` and ${warnings.summary.subscriptionsAffected} ${warnings.summary.subscriptionsAffected === 1 ? 'subscription' : 'subscriptions'} will be cancelled`
                  }
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={props.onConfirm}
            className="bg-destructive hover:bg-destructive/90"
            disabled={!hasValidSelection || selectedCount === 0}
          >
            Delete {selectedCount} {selectedCount === 1 ? 'Transaction' : 'Transactions'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
