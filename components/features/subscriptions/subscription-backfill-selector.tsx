'use client';

import { useState, useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface PastTransaction {
  id: number;
  dealDate: string;
  chargedAmountIls: string;
  transactionHash: string;
  transactionType: string;
}

interface SubscriptionBackfillSelectorProps {
  businessId: number | null;
  businessName: string;
  cardId: number | null;
  startDate: string;
  onSelectionChange: (selectedTransactionIds: number[]) => void;
  initialSelectedIds?: number[];
}

export function SubscriptionBackfillSelector({
  businessId,
  businessName,
  cardId,
  startDate,
  onSelectionChange,
  initialSelectedIds = [],
}: SubscriptionBackfillSelectorProps) {
  const [transactions, setTransactions] = useState<PastTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(initialSelectedIds));
  const [isLoading, setIsLoading] = useState(false);
  const hasNotifiedInitial = useRef(false);

  // Sync selectedIds state when initialSelectedIds prop changes - DO NOT call onSelectionChange here
  const prevInitialIdsRef = useRef<number[]>([]);
  useEffect(() => {
    // Only update if initialSelectedIds actually changed
    const idsChanged = 
      initialSelectedIds.length !== prevInitialIdsRef.current.length ||
      initialSelectedIds.some((id, idx) => id !== prevInitialIdsRef.current[idx]);
    
    if (idsChanged) {
      prevInitialIdsRef.current = initialSelectedIds;
      setSelectedIds(new Set(initialSelectedIds));
      // DO NOT call onSelectionChange here - it causes infinite loops
      // The parent already has the initial data, we just need to sync our local state
      hasNotifiedInitial.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedIds]);

  // Fetch past transactions when inputs change
  useEffect(() => {
    if ((!businessId && !businessName) || !cardId || !startDate) {
      setTransactions([]);
      return;
    }

    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          cardId: cardId.toString(),
          startDate: startDate,
          endDate: new Date().toISOString().split('T')[0], // Today
        });

        // Add businessId or businessName
        if (businessId) {
          params.append('businessId', businessId.toString());
        } else {
          params.append('businessName', businessName);
        }

        const response = await fetch(`/api/subscriptions/backfill-candidates?${params}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.status} ${response.statusText}`);
        }

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Expected JSON but got:', contentType, text.substring(0, 200));
          throw new Error('Server returned non-JSON response');
        }

        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (error) {
        console.error('Error fetching backfill candidates:', error);
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [businessId, businessName, cardId, startDate]);

  const handleToggle = (transactionId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedIds(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const handleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      // Deselect all
      setSelectedIds(new Set());
      onSelectionChange([]);
    } else {
      // Select all
      const allIds = new Set(transactions.map((t) => t.id));
      setSelectedIds(allIds);
      onSelectionChange(Array.from(allIds));
    }
  };

  if ((!businessId && !businessName) || !cardId || !startDate) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link Past Transactions (Optional)</CardTitle>
          <CardDescription>
            Loading past transactions for {businessName}...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link Past Transactions (Optional)</CardTitle>
          <CardDescription>
            No past transactions found for {businessName} between {startDate} and today.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const allSelected = selectedIds.size === transactions.length && transactions.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < transactions.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Link Past Transactions (Optional)</CardTitle>
            <CardDescription>
              Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} for {businessName} between{' '}
              {startDate} and today
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all transactions"
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              {allSelected ? 'Deselect All' : someSelected ? `Select All (${selectedIds.size}/${transactions.length})` : 'Select All'}
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {transactions.map((transaction) => {
            const isSelected = selectedIds.has(transaction.id);
            const date = new Date(transaction.dealDate);
            const formattedDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY
            const amount = parseFloat(transaction.chargedAmountIls).toFixed(2);

            return (
              <div
                key={transaction.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isSelected ? 'bg-primary/5 border-primary' : 'bg-background border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox 
                    checked={isSelected} 
                    onCheckedChange={() => handleToggle(transaction.id)}
                  />
                  <div>
                    <div className="font-medium">{formattedDate}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.transactionType === 'installment' && (
                        <Badge variant="outline" className="mr-1 text-xs">
                          Installment
                        </Badge>
                      )}
                      {transaction.transactionType === 'subscription' && (
                        <Badge variant="outline" className="mr-1 text-xs">
                          Already Subscription
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="font-semibold">₪{amount}</div>
              </div>
            );
          })}
        </div>
        {selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">
              {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              These transactions will be linked to the subscription and marked as subscription payments.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
