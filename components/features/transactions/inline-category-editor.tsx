'use client';

import { useState, useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { useFilterOptions } from '@/hooks/use-filter-options';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

interface InlineCategoryEditorProps {
  businessId: number;
  businessName: string;
  currentPrimaryCategory: string | null;
  currentChildCategory: string | null;
}

export function InlineCategoryEditor({
  businessId,
  businessName,
  currentPrimaryCategory,
  currentChildCategory,
}: InlineCategoryEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [selectedChild, setSelectedChild] = useState<string>('');
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

  const handleEditClick = () => {
    // Pre-fill with current values
    if (currentPrimaryCategory && filterOptions) {
      const parentCat = filterOptions.categories.tree.find(
        (cat) => cat.label === currentPrimaryCategory
      );
      if (parentCat) {
        setSelectedParent(parentCat.value.toString());

        // Pre-fill child if exists
        if (currentChildCategory && parentCat.children) {
          const childCat = parentCat.children.find(
            (child) => child.label === currentChildCategory
          );
          if (childCat) {
            setSelectedChild(childCat.value.toString());
          }
        }
      }
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedParent('');
    setSelectedChild('');
  };

  const handleSaveClick = () => {
    if (!selectedParent) {
      alert('Please select a category');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_category_id: parseInt(selectedParent),
          child_category_id: selectedChild && selectedChild !== 'null' ? parseInt(selectedChild) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });

      setIsEditing(false);
      setShowConfirm(false);
      setSelectedParent('');
      setSelectedChild('');
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isEditing) {
    return (
      <div
        className="group relative cursor-pointer"
        onClick={handleEditClick}
      >
        <div className="text-sm group-hover:opacity-60 transition-opacity">
          {currentPrimaryCategory && (
            <div className="font-medium">{currentPrimaryCategory}</div>
          )}
          {currentChildCategory && (
            <div className="text-muted-foreground">{currentChildCategory}</div>
          )}
          {!currentPrimaryCategory && (
            <span className="text-muted-foreground">Uncategorized</span>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white rounded-full p-1 shadow-md">
            <Pencil className="h-3 w-3 text-gray-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="space-y-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveClick();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
          }
        }}
      >
        <Select value={selectedParent} onValueChange={setSelectedParent}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Main Category" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions?.categories.parents.map((cat) => (
              <SelectItem key={cat.value} value={cat.value.toString()}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedChild}
          onValueChange={setSelectedChild}
          disabled={!selectedParent || childOptions.length === 0}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Sub Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">None</SelectItem>
            {childOptions.map((child) => (
              <SelectItem key={child.value} value={child.value.toString()}>
                {child.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button size="sm" onClick={handleSaveClick} className="h-7 text-xs flex-1">
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="h-7 text-xs flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Category for All Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the category for <strong>ALL</strong> transactions from{' '}
              <strong>{businessName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              disabled={isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
