'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, Wallet, History } from 'lucide-react';
import type { Category } from '@/hooks/use-categories';
import { useBusinessCount } from '@/hooks/use-categories';

interface CategoryActionsSheetProps {
  category: Category;
  onSetBudget: () => void;
  onBudgetHistory?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CategoryActionsSheet({
  category,
  onSetBudget,
  onBudgetHistory,
  onEdit,
  onDelete,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: CategoryActionsSheetProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const { data: businessCount } = useBusinessCount(category.id);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange || setInternalIsOpen;

  const handleSetBudget = () => {
    onSetBudget();
    setIsOpen(false);
  };

  const handleBudgetHistory = () => {
    if (onBudgetHistory) {
      onBudgetHistory();
      setIsOpen(false);
    }
  };

  const handleEdit = () => {
    onEdit();
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>{category.name}</SheetTitle>
          <SheetDescription>
            {businessCount !== undefined && `${businessCount} ${businessCount === 1 ? 'business' : 'businesses'}`}
            {category.budgetAmount && ` • Budget: ₪${category.budgetAmount.toLocaleString()}`}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 p-4">
          {/* Set Budget Button - Only for level 1 categories or all categories with budgets */}
          {(category.level === 1 || category.budgetAmount) && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSetBudget}
            >
              <Wallet className="h-4 w-4 mr-2" />
              {category.budgetAmount ? 'Update Budget' : 'Set Budget'}
            </Button>
          )}

          {/* Budget History Button - Only if has budget */}
          {category.budgetAmount && onBudgetHistory && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleBudgetHistory}
            >
              <History className="h-4 w-4 mr-2" />
              Budget History
            </Button>
          )}

          {/* Edit Button */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleEdit}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Category
          </Button>

          {/* Delete Button */}
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Category
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
