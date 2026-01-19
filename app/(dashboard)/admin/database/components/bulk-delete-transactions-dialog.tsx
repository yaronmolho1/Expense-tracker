'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCards } from '@/hooks/use-cards';
import { EnhancedDeleteConfirmDialog } from './enhanced-delete-confirm-dialog';
import { useQueryClient } from '@tanstack/react-query';

export function BulkDeleteTransactionsDialog() {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warnings, setWarnings] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Checkbox selections
  const [includeOneTime, setIncludeOneTime] = useState(true);
  const [includeInstallments, setIncludeInstallments] = useState(true);
  const [includeSubscriptions, setIncludeSubscriptions] = useState(true);

  // Strategies
  const [installmentStrategy, setInstallmentStrategy] = useState<'delete_all_matching_groups' | 'delete_matching_only' | 'skip_all'>('delete_all_matching_groups');
  const [subscriptionStrategy, setSubscriptionStrategy] = useState<'skip' | 'delete_in_range_and_cancel'>('skip');

  const { data: cards = [] } = useCards('default-user');
  const queryClient = useQueryClient();

  const handlePreview = async () => {
    setDeleting(true);

    try {
      const response = await fetch('/api/admin/transactions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          cardIds: selectedCards.length > 0 ? selectedCards : undefined,
          // Don't pass strategies in preview - let API return all data
        }),
      });

      const data = await response.json();

      if (data.summary && data.summary.totalInRange > 0) {
        setWarnings(data);
        setConfirmOpen(true);
      } else if (data.summary?.totalInRange === 0) {
        toast.info('No transactions found matching the criteria');
      } else {
        toast.error(data.error || 'Failed to preview deletion');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to preview deletion');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmedDelete = async () => {
    setDeleting(true);

    try {
      const response = await fetch('/api/admin/transactions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          cardIds: selectedCards.length > 0 ? selectedCards : undefined,
          includeOneTime,
          includeInstallments,
          includeSubscriptions,
          installmentStrategy: includeInstallments ? installmentStrategy : 'skip_all',
          subscriptionStrategy: includeSubscriptions ? subscriptionStrategy : 'skip',
        }),
      });

      const data = await response.json();

      if (data.success) {
        const message = `Deleted ${data.deletedTransactions} transaction(s)` +
          (data.cancelledSubscriptions > 0
            ? ` and cancelled ${data.cancelledSubscriptions} subscription(s)`
            : '');
        toast.success(message);

        setConfirmOpen(false);
        setOpen(false);

        // Reset form
        setDateFrom('');
        setDateTo('');
        setSelectedCards([]);
        setIncludeOneTime(true);
        setIncludeInstallments(true);
        setIncludeSubscriptions(true);
        setInstallmentStrategy('delete_all_matching_groups');
        setSubscriptionStrategy('skip');

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
        queryClient.invalidateQueries({ queryKey: ['time-flow'] });
      } else {
        toast.error(data.error || 'Failed to delete transactions');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete transactions');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete transactions
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delete Transactions by Date Range</DialogTitle>
            <DialogDescription>
              Select date range and filters to delete multiple transactions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range */}
            <div>
              <Label className="mb-2">Date Range</Label>
              <DateRangePicker
                fromValue={dateFrom}
                toValue={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                fromLabel="From Date"
                toLabel="To Date"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to search from beginning or to end
              </p>
            </div>

            {/* Card Filter */}
            <div>
              <Label>Cards (Optional)</Label>
              <MultiSelect
                options={cards.map(c => ({
                  value: c.id.toString(),
                  label: c.nickname || `•••• ${c.last4}`,
                }))}
                selected={selectedCards.map(String)}
                onChange={(values) => setSelectedCards(values.map(Number))}
                placeholder="All cards"
              />
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Warning</p>
                  <p className="mt-1">
                    This will permanently delete all matching transactions.
                    You'll review affected installments before confirming.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePreview}
              disabled={deleting || (!dateFrom && !dateTo && selectedCards.length === 0)}
            >
              {deleting ? 'Loading...' : 'Preview Deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      {warnings && (
        <EnhancedDeleteConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          warnings={warnings}

          includeOneTime={includeOneTime}
          includeInstallments={includeInstallments}
          includeSubscriptions={includeSubscriptions}
          onIncludeOneTimeChange={setIncludeOneTime}
          onIncludeInstallmentsChange={setIncludeInstallments}
          onIncludeSubscriptionsChange={setIncludeSubscriptions}

          installmentStrategy={installmentStrategy}
          onInstallmentStrategyChange={setInstallmentStrategy}
          subscriptionStrategy={subscriptionStrategy}
          onSubscriptionStrategyChange={setSubscriptionStrategy}

          onConfirm={handleConfirmedDelete}
        />
      )}
    </>
  );
}
