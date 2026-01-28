'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscriptions, useSubscriptionSuggestions, useCancelSubscription, useCreateSubscription, useApproveSuggestion, useRejectSuggestion } from '@/hooks/use-subscriptions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Bell, Plus, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';
import { AddSubscriptionForm, type SubscriptionFormData } from '@/components/features/subscriptions/add-subscription-form';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';

interface CompletedTransaction {
  id: number;
  date: string;
  amount: string;
}

export default function ManageSubscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'cancelled' | 'ended' | 'suggestions' | undefined>('active');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [suggestionToApprove, setSuggestionToApprove] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Restore tab from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'suggestions') {
      setStatusFilter('suggestions');
    }
  }, []);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [subscriptionToEdit, setSubscriptionToEdit] = useState<{
    id: number;
    name: string | null;
  } | null>(null);
  const [editedName, setEditedName] = useState<string>('');
  const [effectiveCancellationDate, setEffectiveCancellationDate] = useState<string>('');

  const queryClient = useQueryClient();
  const { data: subscriptions, isLoading } = useSubscriptions(statusFilter === 'suggestions' ? undefined : statusFilter);
  const { data: suggestions } = useSubscriptionSuggestions('pending');
  const cancelMutation = useCancelSubscription();
  const createMutation = useCreateSubscription();
  const approveMutation = useApproveSuggestion();
  const rejectMutation = useRejectSuggestion();

  // Store stable reference to transaction IDs to prevent infinite loops
  const stableTransactionIdsRef = useRef<number[]>([]);
  const currentSuggestionIdRef = useRef<number | null>(null);

  const pendingSuggestionsCount = suggestions?.length || 0;

  const handleCreateSubscription = async (formData: SubscriptionFormData) => {
    try {
      // Check for duplicate subscription
      const duplicateCheck = subscriptions?.find(
        (sub) =>
          sub.businessId === formData.businessId &&
          sub.cardId === formData.cardId &&
          sub.status === 'active'
      );

      if (duplicateCheck) {
        const confirmDuplicate = confirm(
          `A similar active subscription already exists for ${duplicateCheck.businessName} with this card. Do you want to create it anyway?`
        );
        if (!confirmDuplicate) return;
      }

      // Create subscription
      const result = await createMutation.mutateAsync({
        name: formData.name || undefined,
        businessId: formData.businessId!,
        businessName: formData.businessName,
        cardId: formData.cardId!,
        amount: formData.amount!,
        currency: formData.currency,
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        primaryCategoryId: formData.primaryCategoryId || undefined,
        childCategoryId: formData.childCategoryId || undefined,
        notes: formData.notes || undefined,
      });

      setShowAddDialog(false);
      const parts = [];
      if (result.linkedCount > 0) parts.push(`${result.linkedCount} existing transaction${result.linkedCount !== 1 ? 's' : ''} linked`);
      if (result.backfilledCount > 0) parts.push(`${result.backfilledCount} completed`);
      if (result.projectedCount > 0) parts.push(`${result.projectedCount} projected`);

      toast.success('Subscription created successfully!', {
        description: parts.length > 0 ? parts.join(', ') + ' transactions.' : 'No transactions generated.',
      });
    } catch (error) {
      console.error('Failed to create subscription:', error);
      toast.error('Failed to create subscription', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const handleInitiateCancel = async (subscriptionId: number) => {
    const subscription = subscriptions?.find(s => s.id === subscriptionId);

    setSubscriptionToCancel({
      id: subscriptionId,
      name: subscription?.businessName || 'Unknown',
    });

    // Default to today's date
    const today = new Date().toISOString().split('T')[0];
    setEffectiveCancellationDate(today);
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!subscriptionToCancel || !effectiveCancellationDate) {
      toast.error('Please select an effective cancellation date');
      return;
    }

    try {
      await cancelMutation.mutateAsync({
        id: subscriptionToCancel.id,
        effectiveDate: effectiveCancellationDate,
      });

      setShowCancelDialog(false);
      setSubscriptionToCancel(null);
      setEffectiveCancellationDate('');

      const selectedDate = new Date(effectiveCancellationDate);
      const today = new Date();
      const isFuture = selectedDate > today;

      toast.success('Subscription cancelled successfully!', {
        description: isFuture
          ? `Subscription will remain active until ${formatDate(effectiveCancellationDate)}.`
          : `Subscription cancelled retroactively from ${formatDate(effectiveCancellationDate)}.`,
      });
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error('Failed to cancel subscription', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleInitiateEdit = (subscriptionId: number) => {
    const subscription = subscriptions?.find(s => s.id === subscriptionId);
    if (!subscription) return;

    setSubscriptionToEdit({
      id: subscriptionId,
      name: subscription.name || null,
    });
    setEditedName(subscription.name || '');
    setShowEditDialog(true);
  };

  const handleConfirmEdit = async () => {
    if (!subscriptionToEdit) return;

    try {
      const response = await fetch(`/api/subscriptions/${subscriptionToEdit.id}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName || null }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription name');
      }

      setShowEditDialog(false);
      setSubscriptionToEdit(null);
      setEditedName('');

      // Refresh subscription list
      window.location.reload();

      toast.success('Subscription name updated successfully!');
    } catch (error) {
      console.error('Failed to update subscription name:', error);
      toast.error('Failed to update subscription name', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleDetectSubscriptions = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch('/api/subscriptions/detect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to detect subscriptions');
      }

      const data = await response.json();

      toast.success('Subscription detection complete!', {
        description: data.message,
      });

      // Refresh suggestions - keep on suggestions tab
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'suggestions');
      window.location.href = url.toString();
    } catch (error) {
      console.error('Failed to detect subscriptions:', error);
      toast.error('Failed to detect subscriptions', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleInitiateApprove = async (suggestion: any) => {
    // Fetch business to get category info and matching transaction IDs
    try {
      const [businessResponse, transactionsResponse] = await Promise.all([
        fetch(`/api/businesses?name=${encodeURIComponent(suggestion.businessName)}`),
        fetch(`/api/subscriptions/suggestions/${suggestion.id}/transactions`),
      ]);

      const businessData = await businessResponse.json();
      const transactionsData = await transactionsResponse.json();

      const business = businessData.businesses?.find((b: any) => b.display_name === suggestion.businessName);

      setSuggestionToApprove({
        ...suggestion,
        primaryCategoryId: business?.primary_category?.id || null,
        childCategoryId: business?.child_category?.id || null,
        detectedTransactionIds: transactionsData.transactionIds || [],
      });
      setShowApproveDialog(true);
    } catch (error) {
      console.error('Failed to fetch business categories:', error);
      // Still open dialog even if business fetch fails
      setSuggestionToApprove(suggestion);
      setShowApproveDialog(true);
    }
  };

  // Prepare initialData for the approve form
  const approveFormInitialData = (() => {
    if (!suggestionToApprove) return null;

    // Update stable transaction IDs only when suggestion ID changes
    if (suggestionToApprove.id !== currentSuggestionIdRef.current) {
      currentSuggestionIdRef.current = suggestionToApprove.id;
      stableTransactionIdsRef.current = suggestionToApprove.detectedTransactionIds || [];
    }

    return {
      businessName: suggestionToApprove.businessName,
      businessId: null, // Will be resolved from businessName
      cardId: suggestionToApprove.cardId,
      amount: parseFloat(suggestionToApprove.detectedAmount),
      currency: 'ILS' as const,
      frequency: suggestionToApprove.frequency,
      startDate: suggestionToApprove.firstOccurrence,
      endDate: null,
      noEndDate: true,
      primaryCategoryId: suggestionToApprove.primaryCategoryId || null,
      childCategoryId: suggestionToApprove.childCategoryId || null,
      initialBackfillIds: stableTransactionIdsRef.current,
    };
  })();


  
  const handleConfirmApprove = async (formData: SubscriptionFormData) => {
    if (!suggestionToApprove) return;

    try {
      // Create subscription using the regular create flow (which handles backfill properly)
      await createMutation.mutateAsync({
        name: formData.name || undefined,
        businessId: formData.businessId!,
        businessName: formData.businessName,
        cardId: formData.cardId!,
        amount: formData.amount!,
        currency: formData.currency,
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        primaryCategoryId: formData.primaryCategoryId || undefined,
        childCategoryId: formData.childCategoryId || undefined,
        notes: formData.notes || undefined,
        backfillTransactionIds: formData.backfillTransactionIds,
      });

      // Mark suggestion as approved (without creating transactions)
      await fetch(`/api/subscriptions/suggestions/${suggestionToApprove.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipTransactionCreation: true }),
      });

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['subscription-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });

      setShowApproveDialog(false);
      setSuggestionToApprove(null);
      toast.success('Subscription created successfully!');
    } catch (error) {
      console.error('Failed to create subscription:', error);
      toast.error('Failed to create subscription', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleRejectSuggestion = async (id: number) => {
    try {
      await rejectMutation.mutateAsync(id);
      toast.success('Suggestion rejected');
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      toast.error('Failed to reject suggestion');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Manage Subscriptions"
        description="Track and manage your recurring payments"
        actions={
          <>
            {statusFilter === 'suggestions' && (
              <Button variant="outline" onClick={handleDetectSubscriptions} disabled={isDetecting}>
                <Bell className="h-4 w-4 mr-2" />
                {isDetecting ? 'Detecting...' : 'Detect Subscriptions'}
              </Button>
            )}
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
          </>
        }
      />

      {/* Status Filter */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('active')}
          size="sm"
        >
          Active
        </Button>
        <Button
          variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('cancelled')}
          size="sm"
        >
          Cancelled
        </Button>
        <Button
          variant={statusFilter === 'ended' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('ended')}
          size="sm"
        >
          Ended
        </Button>
        <Button
          variant={statusFilter === 'suggestions' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('suggestions')}
          size="sm"
        >
          Suggestions
          {pendingSuggestionsCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingSuggestionsCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={statusFilter === undefined ? 'default' : 'outline'}
          onClick={() => setStatusFilter(undefined)}
          size="sm"
        >
          All
        </Button>
      </div>

      {/* Subscriptions Table or Suggestions */}
      {statusFilter === 'suggestions' ? (
        /* Suggestions View */
        !suggestions || suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">No pending suggestions</p>
                <p className="text-sm mt-2">
                  Click "Detect Subscriptions" to analyze transaction patterns
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{suggestion.businessName}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">
                          {suggestion.frequency === 'monthly' ? 'Monthly' : 'Annual'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Card: ****{suggestion.cardLast4}
                          {suggestion.cardNickname && ` (${suggestion.cardNickname})`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatCurrency(suggestion.detectedAmount)}
                      </div>
                      <div className="text-sm text-muted-foreground">per charge</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        First Occurrence
                      </div>
                      <div className="text-sm">{formatDate(suggestion.firstOccurrence)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Last Occurrence
                      </div>
                      <div className="text-sm">{formatDate(suggestion.lastOccurrence)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Times Detected
                      </div>
                      <div className="text-sm">{suggestion.occurrenceCount} charges</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Detection Reason
                      </div>
                      <div className="text-sm capitalize">
                        {suggestion.detectionReason || 'Pattern analysis'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectSuggestion(suggestion.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleInitiateApprove(suggestion)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Review & Create Subscription
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* Subscriptions Table */
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : !subscriptions || subscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No subscriptions found
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{sub.name || '—'}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInitiateEdit(sub.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{sub.businessName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">****{sub.cardLast4}</span>
                        {sub.cardNickname && (
                          <span className="text-xs text-muted-foreground">
                            {sub.cardNickname}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(sub.amount)}</TableCell>
                    <TableCell className="capitalize">{sub.frequency}</TableCell>
                    <TableCell>{formatDate(sub.startDate)}</TableCell>
                    <TableCell>
                      {sub.endDate ? formatDate(sub.endDate) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          sub.status === 'active'
                            ? 'default'
                            : sub.status === 'cancelled'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInitiateCancel(sub.id)}
                          disabled={cancelMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Subscription Dialog */}
      {showAddDialog && (
        <Dialog open={true} onOpenChange={setShowAddDialog} modal={true}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-scroll">
            <DialogHeader>
              <DialogTitle>Add New Subscription</DialogTitle>
              <DialogDescription>
                Create a new recurring payment subscription
              </DialogDescription>
            </DialogHeader>
            <AddSubscriptionForm
              key="manual-create"
              onSubmit={handleCreateSubscription}
              onCancel={() => setShowAddDialog(false)}
              isSubmitting={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Subscription Dialog with Effective Date */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Select the effective cancellation date for {subscriptionToCancel?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <label htmlFor="effectiveDate" className="block text-sm font-medium mb-2">
                Effective Cancellation Date
              </label>
              <DatePicker
                value={effectiveCancellationDate}
                onChange={setEffectiveCancellationDate}
                placeholder="Select date"
              />
            </div>

            <div className="text-sm text-muted-foreground space-y-2 bg-accent/50 p-3 rounded-md">
              <p><strong>How this works:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Future date:</strong> Subscription stays active until selected date</li>
                <li><strong>Past date:</strong> Retroactively cancels from that date (deletes transactions)</li>
                <li><strong>Today:</strong> Cancels immediately</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setSubscriptionToCancel(null);
                setEffectiveCancellationDate('');
              }}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending || !effectiveCancellationDate}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Name Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription Name</DialogTitle>
            <DialogDescription>
              Change the display name for this subscription
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="subscriptionName">Subscription Name</Label>
            <Input
              id="subscriptionName"
              type="text"
              placeholder="e.g., Netflix Premium, Spotify Family"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSubscriptionToEdit(null);
                setEditedName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Suggestion Dialog */}
      {showApproveDialog && (
        <Dialog open={true} onOpenChange={(open) => {
          setShowApproveDialog(open);
          if (!open) setSuggestionToApprove(null);
        }} modal={true}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-scroll">
            <DialogHeader>
              <DialogTitle>Review & Create Subscription</DialogTitle>
              <DialogDescription>
                Review and edit the detected subscription details before creating
              </DialogDescription>
            </DialogHeader>
            {approveFormInitialData && (
              <AddSubscriptionForm
                key={`approve-${suggestionToApprove?.id}`}
                onSubmit={handleConfirmApprove}
                onCancel={() => {
                  setShowApproveDialog(false);
                  setSuggestionToApprove(null);
                }}
                isSubmitting={createMutation.isPending}
                initialData={approveFormInitialData}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
