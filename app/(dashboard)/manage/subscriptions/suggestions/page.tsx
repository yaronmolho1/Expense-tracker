'use client';

import { useSubscriptionSuggestions, useApproveSuggestion, useRejectSuggestion } from '@/hooks/use-subscriptions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, X } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionSuggestionsPage() {
  const { data: suggestions, isLoading } = useSubscriptionSuggestions('pending');
  const approveMutation = useApproveSuggestion();
  const rejectMutation = useRejectSuggestion();

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const handleApprove = async (id: number) => {
    await approveMutation.mutateAsync({
      id,
      // Optional parameters - use defaults from suggestion
      adjustedAmount: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const handleReject = async (id: number) => {
    await rejectMutation.mutateAsync(id);
  };

  return (
    <>
      <div className="mb-6">
        <Link href="/manage/subscriptions">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Subscriptions
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Subscription Suggestions</h1>
        <p className="text-muted-foreground mt-1">
          Auto-detected recurring payment patterns
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !suggestions || suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">No pending suggestions</p>
              <p className="text-sm mt-2">
                Suggestions will appear here when recurring patterns are detected
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
                    onClick={() => handleReject(suggestion.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(suggestion.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve & Create Subscription
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
