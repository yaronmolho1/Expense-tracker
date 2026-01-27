'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteBusinessDialogProps {
  businessId: number | null;
  businessName: string;
  onConfirm: (businessId: number, deleteMerged: boolean) => void;
  onCancel: () => void;
  isDeleting: boolean;
}

interface MergedBusinessInfo {
  id: number;
  displayName: string;
  normalizedName: string;
  transactionCount: number;
  totalSpent: number;
}

interface BusinessDeleteInfo {
  hasMergedBusinesses: boolean;
  parentTransactionCount: number;
  parentTotalSpent: number;
  mergedBusinesses: MergedBusinessInfo[];
  mergedTotalTransactions: number;
  mergedTotalSpent: number;
}

export function DeleteBusinessDialog({
  businessId,
  businessName,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteBusinessDialogProps) {
  const [deleteOption, setDeleteOption] = useState<'parent_only' | 'all'>('parent_only');
  const [businessInfo, setBusinessInfo] = useState<BusinessDeleteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setBusinessInfo(null);
      return;
    }

    const fetchBusinessInfo = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/businesses/${businessId}/delete-info`);
        if (!response.ok) throw new Error('Failed to fetch business info');
        const data = await response.json();
        setBusinessInfo(data);

        // Default to 'all' if there are merged businesses
        if (data.hasMergedBusinesses) {
          setDeleteOption('all');
        } else {
          setDeleteOption('parent_only');
        }
      } catch (error) {
        console.error('Failed to fetch business delete info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessInfo();
  }, [businessId]);

  const handleConfirm = () => {
    if (!businessId) return;
    onConfirm(businessId, deleteOption === 'all');
  };

  const handleCancel = () => {
    setDeleteOption('parent_only');
    onCancel();
  };

  return (
    <AlertDialog open={!!businessId} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete Business</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the business and all associated transactions.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading business information...
          </div>
        ) : businessInfo ? (
          <div className="space-y-6">
            {/* Parent Business Info */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="font-semibold text-lg mb-2">{businessName}</div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transactions:</span>
                  <span className="font-medium">{businessInfo.parentTransactionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Spent:</span>
                  <span className="font-medium">
                    ₪{businessInfo.parentTotalSpent.toLocaleString('en-IL', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Merged Businesses Section */}
            {businessInfo.hasMergedBusinesses && (
              <div className="space-y-3">
                <div className="font-semibold">
                  Merged Businesses ({businessInfo.mergedBusinesses.length})
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3 bg-accent/20">
                  {businessInfo.mergedBusinesses.map((merged) => (
                    <div key={merged.id} className="border-b last:border-b-0 pb-2 last:pb-0">
                      <div className="font-medium">{merged.displayName}</div>
                      <div className="text-sm text-muted-foreground">{merged.normalizedName}</div>
                      <div className="text-sm flex justify-between mt-1">
                        <span>{merged.transactionCount} transactions</span>
                        <span className="font-medium">
                          ₪{merged.totalSpent.toLocaleString('en-IL', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="border rounded-lg p-3 bg-accent/30">
                  <div className="text-sm font-semibold mb-1">Merged Totals</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transactions:</span>
                      <span className="font-medium">{businessInfo.mergedTotalTransactions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Spent:</span>
                      <span className="font-medium">
                        ₪{businessInfo.mergedTotalSpent.toLocaleString('en-IL', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete Options */}
                <div className="space-y-3 pt-2">
                  <Label className="font-semibold">What would you like to delete?</Label>
                  <RadioGroup value={deleteOption} onValueChange={(value) => setDeleteOption(value as 'parent_only' | 'all')}>
                    <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value="parent_only" id="parent_only" />
                      <Label htmlFor="parent_only" className="flex-1 cursor-pointer">
                        <div className="font-medium">Delete parent business only</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          The {businessInfo.mergedBusinesses.length} merged {businessInfo.mergedBusinesses.length === 1 ? 'business' : 'businesses'} will be restored as active {businessInfo.mergedBusinesses.length === 1 ? 'business' : 'businesses'}. Their transactions will remain intact.
                        </div>
                        <div className="text-sm font-medium text-destructive mt-2">
                          Will delete: {businessInfo.parentTransactionCount} transactions (₪{businessInfo.parentTotalSpent.toLocaleString('en-IL')})
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent cursor-pointer border-destructive/50">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="flex-1 cursor-pointer">
                        <div className="font-medium text-destructive">Delete all (parent and merged businesses)</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          All {businessInfo.mergedBusinesses.length} merged {businessInfo.mergedBusinesses.length === 1 ? 'business' : 'businesses'} and their transactions will be permanently deleted.
                        </div>
                        <div className="text-sm font-medium text-destructive mt-2">
                          Will delete: {businessInfo.parentTransactionCount + businessInfo.mergedTotalTransactions} total transactions
                          (₪{(businessInfo.parentTotalSpent + businessInfo.mergedTotalSpent).toLocaleString('en-IL')})
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* No merged businesses - just show warning */}
            {!businessInfo.hasMergedBusinesses && (
              <div className="border-l-4 border-destructive pl-4 py-2">
                <p className="text-sm font-medium text-destructive">
                  This will delete {businessInfo.parentTransactionCount} {businessInfo.parentTransactionCount === 1 ? 'transaction' : 'transactions'} (₪{businessInfo.parentTotalSpent.toLocaleString('en-IL')})
                </p>
              </div>
            )}
          </div>
        ) : null}

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting || isLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete Business'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
