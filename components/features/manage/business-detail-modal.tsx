'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Tag, CheckCircle, XCircle } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

interface Business {
  id: number;
  normalized_name: string;
  display_name: string;
  primary_category: Category | null;
  child_category: Category | null;
  categorization_source: string | null;
  approved: boolean;
  transaction_count: number;
  total_spent: number;
  last_used_date: string | null;
  merged_businesses?: Array<{
    id: number;
    name: string;
    merged_at: string;
  }>;
}

interface BusinessDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business | null;
  onEdit?: (business: Business) => void;
  onDelete?: (business: Business) => void;
  onSetCategory?: (business: Business) => void;
  onApprove?: (business: Business) => void;
}

export function BusinessDetailModal({
  isOpen,
  onClose,
  business,
  onEdit,
  onDelete,
  onSetCategory,
  onApprove,
}: BusinessDetailModalProps) {
  if (!business) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            Business Details
          </DialogTitle>
        </DialogHeader>

        {/* Business Details */}
        <div className="space-y-5 px-1">
          {/* Business Name */}
          <div className="pb-3 border-b">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Display Name</div>
            <div className="text-lg sm:text-xl font-semibold">{business.display_name}</div>
            {business.display_name !== business.normalized_name && (
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                Normalized: {business.normalized_name}
              </div>
            )}
          </div>

          {/* Main Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 bg-muted/40 rounded-lg border">
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Total Spent</div>
              <div className="text-lg sm:text-xl font-semibold text-foreground">
                {formatCurrency(business.total_spent)}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Transactions</div>
              <div className="text-base sm:text-lg">{business.transaction_count}</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Last Used</div>
              <div className="text-base sm:text-lg">{formatDate(business.last_used_date)}</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Approval Status</div>
              <div className="text-base sm:text-lg flex items-center gap-2">
                {business.approved ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Approved</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-amber-600" />
                    <span>Unapproved</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Category Info */}
          <div className="p-4 sm:p-5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5">Category</div>
            <div className="text-base sm:text-lg font-medium">
              {business.primary_category?.name || 'Uncategorized'}
              {business.child_category && (
                <>
                  <br />
                  <span className="text-sm sm:text-base text-muted-foreground font-normal">{business.child_category.name}</span>
                </>
              )}
            </div>
            {business.categorization_source && (
              <div className="text-xs text-muted-foreground mt-2">
                Source: {business.categorization_source}
              </div>
            )}
          </div>

          {/* Merge History */}
          {business.merged_businesses && business.merged_businesses.length > 0 && (
            <div className="p-4 sm:p-5 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900">
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5">Merged Businesses</div>
              <div className="space-y-2 mt-2">
                {business.merged_businesses.map((merged) => (
                  <div key={merged.id} className="text-sm">
                    <div className="font-medium">{merged.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Merged: {formatDate(merged.merged_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {(onEdit || onSetCategory || onApprove || onDelete) && (
            <div className="flex flex-col sm:flex-row gap-2 border-t pt-5 mt-5">
              {onEdit && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onEdit(business);
                    onClose();
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Name
                </Button>
              )}
              {onSetCategory && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onSetCategory(business);
                    onClose();
                  }}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Set Category
                </Button>
              )}
              {onApprove && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onApprove(business);
                    onClose();
                  }}
                >
                  {business.approved ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Unapprove
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    onDelete(business);
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
    </Dialog>
  );
}
