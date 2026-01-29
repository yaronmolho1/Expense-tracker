'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { Transaction } from '@/hooks/use-transactions';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface MobileCategoryEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export function MobileCategoryEditorDialog({
  isOpen,
  onClose,
  transaction,
}: MobileCategoryEditorDialogProps) {
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: filterOptions } = useFilterOptions();
  const queryClient = useQueryClient();

  const childOptions = useMemo(() => {
    if (!selectedParent || !filterOptions) return [];
    const parent = filterOptions.categories.tree.find(
      (cat) => cat.value.toString() === selectedParent
    );
    return parent?.children || [];
  }, [selectedParent, filterOptions]);

  // Pre-fill current category when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && transaction && filterOptions) {
      // Pre-fill with current values
      if (transaction.category.primary) {
        const parentCat = filterOptions.categories.tree.find(
          (cat) => cat.label === transaction.category.primary
        );
        if (parentCat) {
          setSelectedParent(parentCat.value.toString());

          // Pre-fill child if exists
          if (transaction.category.child && parentCat.children) {
            const childCat = parentCat.children.find(
              (child) => child.label === transaction.category.child
            );
            if (childCat) {
              setSelectedChild(childCat.value.toString());
            }
          }
        }
      }
    } else if (!open) {
      // Reset state when closing
      setSelectedParent('');
      setSelectedChild('');
      onClose();
    }
  };

  const handleSaveClick = () => {
    if (!selectedParent) {
      toast.error('Please select a category');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!transaction) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/businesses/${transaction.business_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_category_id: parseInt(selectedParent),
          child_category_id: selectedChild ? parseInt(selectedChild) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update category');

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });
      await queryClient.invalidateQueries({ queryKey: ['filterOptions'] });

      toast.success('Category updated successfully');
      setShowConfirm(false);
      onClose();
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error('Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!transaction) return null;

  const selectedParentLabel = filterOptions?.categories.tree.find(
    (cat) => cat.value.toString() === selectedParent
  )?.label;

  const selectedChildLabel = childOptions.find(
    (child) => child.value.toString() === selectedChild
  )?.label;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[90vw] sm:w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Edit Category</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Business Name */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Business
              </div>
              <div className="text-base font-semibold">{transaction.business_name}</div>
            </div>

            {/* Primary Category Select */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Primary Category
              </div>
              <Select value={selectedParent} onValueChange={(value) => {
                setSelectedParent(value);
                setSelectedChild(''); // Reset child when parent changes
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions?.categories.tree.map((category) => (
                    <SelectItem key={category.value} value={category.value.toString()}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Child Category Select */}
            {childOptions.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Subcategory (Optional)
                </div>
                <Select value={selectedChild || 'none'} onValueChange={(value) => setSelectedChild(value === 'none' ? '' : value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {childOptions.map((child) => (
                      <SelectItem key={child.value} value={child.value.toString()}>
                        {child.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onClose()} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveClick} className="flex-1" disabled={!selectedParent}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Category?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  This will update the category for all transactions from <strong>{transaction.business_name}</strong>.
                </p>
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <div className="text-sm font-medium">New category:</div>
                  <div className="text-base font-semibold mt-1">
                    {selectedParentLabel}
                    {selectedChildLabel && (
                      <>
                        <br />
                        <span className="text-sm text-muted-foreground">{selectedChildLabel}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
