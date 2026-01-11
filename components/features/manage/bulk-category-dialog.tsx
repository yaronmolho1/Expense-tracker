'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useBulkUpdateCategories } from '@/hooks/use-businesses';
import { toast } from 'sonner';

interface BulkCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessIds: number[];
  onSuccess?: () => void;
}

export function BulkCategoryDialog({
  open,
  onOpenChange,
  businessIds,
  onSuccess,
}: BulkCategoryDialogProps) {
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');
  const [childCategoryId, setChildCategoryId] = useState<string>('');

  const { data: filterOptions } = useFilterOptions();
  const bulkUpdate = useBulkUpdateCategories();

  // Get available child categories based on selected parent
  const availableChildren = useMemo(() => {
    if (!primaryCategoryId || !filterOptions) return [];

    const parent = filterOptions.categories.tree.find(
      c => c.value.toString() === primaryCategoryId
    );
    return parent?.children || [];
  }, [primaryCategoryId, filterOptions]);

  // Reset child when parent changes
  const handlePrimaryChange = (value: string) => {
    setPrimaryCategoryId(value);
    setChildCategoryId('');
  };

  const handleConfirm = async () => {
    if (!primaryCategoryId) {
      toast.error('Please select a main category');
      return;
    }

    try {
      await bulkUpdate.mutateAsync({
        businessIds,
        primaryCategoryId: parseInt(primaryCategoryId),
        childCategoryId: childCategoryId ? parseInt(childCategoryId) : null,
      });

      toast.success('Categories updated successfully', {
        description: `Updated ${businessIds.length} ${businessIds.length === 1 ? 'business' : 'businesses'}`,
      });

      // Reset and close
      setPrimaryCategoryId('');
      setChildCategoryId('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update categories:', error);
      toast.error('Failed to update categories', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  const handleCancel = () => {
    setPrimaryCategoryId('');
    setChildCategoryId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Category for Multiple Businesses</DialogTitle>
          <DialogDescription>
            Update the category for {businessIds.length} selected {businessIds.length === 1 ? 'business' : 'businesses'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Main Category */}
          <div className="space-y-2">
            <Label>Main Category</Label>
            <Select value={primaryCategoryId} onValueChange={handlePrimaryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select main category" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.categories.parents.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value.toString()}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub Category */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sub Category (Optional)</Label>
              {childCategoryId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0 px-2 text-xs"
                  onClick={() => setChildCategoryId('')}
                >
                  Clear
                </Button>
              )}
            </div>
            <Select
              value={childCategoryId || undefined}
              onValueChange={setChildCategoryId}
              disabled={availableChildren.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  availableChildren.length === 0
                    ? "Select main category first"
                    : "Select sub category (optional)"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableChildren.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value.toString()}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!primaryCategoryId || bulkUpdate.isPending}
          >
            {bulkUpdate.isPending ? 'Updating...' : 'Update Categories'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
