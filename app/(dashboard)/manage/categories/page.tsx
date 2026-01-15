'use client';

import { useState } from 'react';
import { useCategories, useSetBudget, useRemoveBudget, useUpdateCategory, useDeleteCategory, useCreateCategory, useBudgetHistory, useDeleteBudgetHistoryRecord, useDeleteAllBudgetHistory, useBusinessCount, useReorderCategories } from '@/hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Edit, Trash2, Wallet, Plus, History, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import type { Category, SetBudgetInput } from '@/hooks/use-categories';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories('tree');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  const reorderMutation = useReorderCategories();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleCategory = (id: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);

    // Check if it's a child drag (format: "child-{id}")
    if (id.startsWith('child-')) {
      const childId = parseInt(id.replace('child-', ''));
      // Find the parent of this child
      const parent = categories?.find(p => p.children?.some(c => c.id === childId));
      setActiveParentId(parent?.id ?? null);
    } else {
      setActiveParentId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveParentId(null);

    if (!over || active.id === over.id || !categories) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Check if we're dragging parents or children
    const isDraggingParent = activeIdStr.startsWith('parent-');
    const isDraggingChild = activeIdStr.startsWith('child-');

    if (isDraggingParent && overIdStr.startsWith('parent-')) {
      // Reordering parents
      const activeParentId = parseInt(activeIdStr.replace('parent-', ''));
      const overParentId = parseInt(overIdStr.replace('parent-', ''));

      const oldIndex = categories.findIndex(c => c.id === activeParentId);
      const newIndex = categories.findIndex(c => c.id === overParentId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(categories, oldIndex, newIndex);
        const updates = newOrder.map((cat, index) => ({
          id: cat.id,
          displayOrder: index,
        }));

        reorderMutation.mutate(updates, {
          onError: (error) => {
            toast.error(error.message);
          },
        });
      }
    } else if (isDraggingChild && overIdStr.startsWith('child-')) {
      // Reordering children within the same parent
      const activeChildId = parseInt(activeIdStr.replace('child-', ''));
      const overChildId = parseInt(overIdStr.replace('child-', ''));

      // Find parent of active child
      const parentCategory = categories.find(p =>
        p.children?.some(c => c.id === activeChildId)
      );

      if (parentCategory?.children) {
        const oldIndex = parentCategory.children.findIndex(c => c.id === activeChildId);
        const newIndex = parentCategory.children.findIndex(c => c.id === overChildId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(parentCategory.children, oldIndex, newIndex);
          const updates = newOrder.map((cat, index) => ({
            id: cat.id,
            displayOrder: index,
          }));

          reorderMutation.mutate(updates, {
            onError: (error) => {
              toast.error(error.message);
            },
          });
        }
      }
    }
  };

  // Get the active item for drag overlay
  const getActiveItem = (): Category | null => {
    if (!activeId || !categories) return null;

    if (activeId.startsWith('parent-')) {
      const id = parseInt(activeId.replace('parent-', ''));
      return categories.find(c => c.id === id) ?? null;
    } else if (activeId.startsWith('child-')) {
      const id = parseInt(activeId.replace('child-', ''));
      for (const parent of categories) {
        const child = parent.children?.find(c => c.id === id);
        if (child) return child;
      }
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  const parentIds = categories?.map(c => `parent-${c.id}`) ?? [];
  const activeItem = getActiveItem();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your expense categories and set budgets. Drag to reorder.
          </p>
        </div>
        <CreateCategoryDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Drag categories to reorder. Click to expand and manage sub-categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={parentIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {categories?.map((parent) => (
                  <SortableParentCategory
                    key={parent.id}
                    category={parent}
                    isExpanded={expandedCategories.has(parent.id)}
                    onToggle={() => toggleCategory(parent.id)}
                    isDraggingChild={activeParentId === parent.id}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeItem && (
                <div className="bg-background border rounded-lg p-3 shadow-lg opacity-90">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{activeItem.name}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// SORTABLE COMPONENTS
// ============================================

interface SortableParentCategoryProps {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  isDraggingChild: boolean;
}

function SortableParentCategory({ category, isExpanded, onToggle, isDraggingChild }: SortableParentCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `parent-${category.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDraggingChild ? 'ring-2 ring-blue-500' : ''}>
      <CategoryRow
        category={category}
        isExpanded={isExpanded}
        onToggle={onToggle}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {isExpanded && category.children && category.children.length > 0 && (
        <div className="ml-6 mt-2 space-y-1">
          <SortableContext items={category.children.map(c => `child-${c.id}`)} strategy={verticalListSortingStrategy}>
            {category.children.map((child) => (
              <SortableChildCategory key={child.id} category={child} />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

interface SortableChildCategoryProps {
  category: Category;
}

function SortableChildCategory({ category }: SortableChildCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `child-${category.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryRow
        category={category}
        isExpanded={false}
        onToggle={() => {}}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ============================================
// CATEGORY ROW COMPONENT
// ============================================

interface CategoryRowProps {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  dragHandleProps?: any;
}

function CategoryRow({ category, isExpanded, onToggle, dragHandleProps }: CategoryRowProps) {
  const hasChildren = category.children && category.children.length > 0;
  const { data: history } = useBudgetHistory(category.level === 1 ? category.id : 0);

  // Check if budget is only previous (no active budget)
  const hasOnlyPreviousBudget = history && history.length > 0 && !history.some(h => !h.effectiveTo);

  return (
    <div>
      {/* Parent Category */}
      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 border">
        {dragHandleProps && (
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={hasChildren ? onToggle : undefined}
        >
          {hasChildren && (
            <div className="p-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          )}
          {!hasChildren && <div className="w-6" />}

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{category.name}</span>
              {category.level === 0 && (
                <Badge variant="outline" className="text-xs">Parent</Badge>
              )}
              {category.budgetAmount && (
                <Badge
                  variant="secondary"
                  className={`text-xs cursor-help ${hasOnlyPreviousBudget ? 'text-red-600' : ''}`}
                  title={hasOnlyPreviousBudget ? "No active budget - showing latest previous budget" : undefined}
                >
                  {formatCurrency(parseFloat(category.budgetAmount))} / {category.budgetPeriod}
                  {hasOnlyPreviousBudget && " (Previous)"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {category.level === 1 && (
            <>
              <SetBudgetDialog category={category} />
              {category.budgetAmount && <BudgetHistoryDialog categoryId={category.id} />}
            </>
          )}
          <EditCategoryDialog category={category} />
          <DeleteCategoryButton categoryId={category.id} categoryName={category.name} />
        </div>
      </div>

      {/* Child Categories - only show in non-sortable mode */}
      {isExpanded && hasChildren && !dragHandleProps && (
        <div className="ml-8 mt-2 space-y-2">
          {category.children?.map((child) => (
            <ChildCategoryRow key={child.id} category={child} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CHILD CATEGORY ROW COMPONENT
// ============================================

interface ChildCategoryRowProps {
  category: Category;
}

function ChildCategoryRow({ category }: ChildCategoryRowProps) {
  const { data: childHistory } = useBudgetHistory(category.id);
  const childHasOnlyPreviousBudget = childHistory && childHistory.length > 0 && !childHistory.some(h => !h.effectiveTo);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 border border-dashed">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-6" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span>{category.name}</span>
            {category.budgetAmount && (
              <Badge
                variant="secondary"
                className={`text-xs cursor-help ${childHasOnlyPreviousBudget ? 'text-red-600' : ''}`}
                title={childHasOnlyPreviousBudget ? "No active budget - showing latest previous budget" : undefined}
              >
                {formatCurrency(parseFloat(category.budgetAmount))} / {category.budgetPeriod}
                {childHasOnlyPreviousBudget && " (Previous)"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SetBudgetDialog category={category} />
        {category.budgetAmount && <BudgetHistoryDialog categoryId={category.id} />}
        <EditCategoryDialog category={category} />
        <DeleteCategoryButton categoryId={category.id} categoryName={category.name} />
      </div>
    </div>
  );
}

// ============================================
// CREATE CATEGORY DIALOG
// ============================================

function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [displayOrder, setDisplayOrder] = useState('0');

  const { data: categories } = useCategories('tree');
  const createMutation = useCreateCategory();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      parentId: parentId && parentId !== 'none' ? parseInt(parentId) : undefined,
      displayOrder: parseInt(displayOrder) || 0,
    }, {
      onSuccess: () => {
        toast.success('Category created successfully');
        setOpen(false);
        setName('');
        setParentId('');
        setDisplayOrder('0');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new expense category. Leave parent empty to create a top-level category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Groceries, Entertainment"
            />
          </div>

          <div>
            <Label htmlFor="parent">Parent Category (Optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Top-level)</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EDIT CATEGORY DIALOG
// ============================================

interface EditCategoryDialogProps {
  category: Category;
}

function EditCategoryDialog({ category }: EditCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);

  const updateMutation = useUpdateCategory();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    updateMutation.mutate({
      id: category.id,
      input: { name: name.trim() },
    }, {
      onSuccess: () => {
        toast.success('Category updated successfully');
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>

        <div>
          <Label htmlFor="edit-name">Category Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DELETE CATEGORY BUTTON
// ============================================

interface DeleteCategoryButtonProps {
  categoryId: number;
  categoryName: string;
}

function DeleteCategoryButton({ categoryId, categoryName }: DeleteCategoryButtonProps) {
  const deleteMutation = useDeleteCategory();
  const { data: businessCount, isLoading: countLoading, refetch: refetchBusinessCount } = useBusinessCount(categoryId);
  const { data: categories } = useCategories('tree');
  const [open, setOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('uncategorize');

  const handleOpenDialog = async () => {
    await refetchBusinessCount(); // Refetch business count when dialog opens
    setOpen(true);
  };

  const handleDelete = () => {
    const targetId = targetCategoryId === 'uncategorize' ? null : parseInt(targetCategoryId);

    deleteMutation.mutate({ id: categoryId, targetCategoryId: targetId }, {
      onSuccess: () => {
        toast.success('Category deleted successfully');
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  // Get flat list of child categories (exclude the current category being deleted)
  const availableCategories = categories?.flatMap(parent =>
    parent.children?.filter(child => child.id !== categoryId) || []
  ) || [];

  const hasBusinesses = (businessCount ?? 0) > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpenDialog}
        disabled={deleteMutation.isPending || countLoading}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              {countLoading ? (
                <>Loading business count...</>
              ) : hasBusinesses ? (
                <>
                  This category is assigned to {businessCount} business{businessCount !== 1 ? 'es' : ''}.
                  Choose what to do with {businessCount === 1 ? 'it' : 'them'}:
                </>
              ) : (
                <>Are you sure you want to delete "{categoryName}"? This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {hasBusinesses && (
            <div className="space-y-2 py-4">
              <Label htmlFor="target-category">Move businesses to:</Label>
              <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                <SelectTrigger id="target-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorize">Uncategorize (Remove category)</SelectItem>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================
// SET BUDGET DIALOG
// ============================================

interface SetBudgetDialogProps {
  category: Category;
}

function SetBudgetDialog({ category }: SetBudgetDialogProps) {
  const [open, setOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState(category.budgetAmount || '');
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'annual'>(category.budgetPeriod || 'monthly');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [notes, setNotes] = useState('');
  const [backfill, setBackfill] = useState(false);

  const setBudgetMutation = useSetBudget();
  const removeBudgetMutation = useRemoveBudget();

  // Set default effective date based on period
  const getDefaultEffectiveDate = () => {
    const today = new Date();
    if (budgetPeriod === 'monthly') {
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      return `${today.getFullYear()}-01-01`;
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !effectiveDate) {
      setEffectiveDate(getDefaultEffectiveDate());
    }
  };

  const handlePeriodChange = (period: 'monthly' | 'annual') => {
    setBudgetPeriod(period);
    // Reset effective date when period changes
    const today = new Date();
    if (period === 'monthly') {
      setEffectiveDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
    } else {
      setEffectiveDate(`${today.getFullYear()}-01-01`);
    }
  };

  const handleSubmit = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }

    if (!effectiveDate) {
      toast.error('Please select an effective date');
      return;
    }

    const input: SetBudgetInput = {
      budgetAmount: amount,
      budgetPeriod,
      effectiveFrom: effectiveDate,
      notes: notes.trim() || undefined,
      backfillToEarliestTransaction: backfill,
    };

    setBudgetMutation.mutate({ categoryId: category.id, input }, {
      onSuccess: () => {
        toast.success('Budget set successfully');
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleRemove = () => {
    setRemoveDialogOpen(true);
  };

  const confirmRemove = () => {
    removeBudgetMutation.mutate(category.id, {
      onSuccess: () => {
        toast.success('Budget removed');
        setRemoveDialogOpen(false);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant={category.budgetAmount ? 'outline' : 'ghost'} size="icon">
          <Wallet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Budget for {category.name}</DialogTitle>
          <DialogDescription>
            Configure the budget amount and period. Budget will apply from the selected date forward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Budget Amount (ILS)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              placeholder="e.g., 3000.00"
            />
          </div>

          <div>
            <Label htmlFor="period">Budget Period</Label>
            <Select value={budgetPeriod} onValueChange={(val) => handlePeriodChange(val as 'monthly' | 'annual')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="effective-date">
              Effective From {budgetPeriod === 'monthly' ? '(Month)' : '(Year)'}
            </Label>
            {budgetPeriod === 'monthly' ? (
              <div className="flex gap-2">
                <Select
                  value={effectiveDate.substring(5, 7)}
                  onValueChange={(month) => {
                    const year = effectiveDate.substring(0, 4);
                    setEffectiveDate(`${year}-${month}-01`);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                      <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={effectiveDate.substring(0, 4)}
                  onValueChange={(year) => {
                    const month = effectiveDate.substring(5, 7);
                    setEffectiveDate(`${year}-${month}-01`);
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Select
                value={effectiveDate.substring(0, 4)}
                onValueChange={(year) => setEffectiveDate(`${year}-01-01`)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {budgetPeriod === 'monthly'
                ? 'Budget will apply from the 1st of the selected month'
                : 'Budget will apply from January 1st of the selected year'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="backfill"
              checked={backfill}
              onCheckedChange={(checked) => setBackfill(checked as boolean)}
            />
            <Label htmlFor="backfill" className="text-sm font-normal">
              Apply this budget to past months (from earliest transaction)
            </Label>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Increased due to inflation"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {category.budgetAmount && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeBudgetMutation.isPending}
              className="w-full sm:w-auto"
            >
              Remove Budget
            </Button>
          )}
          <div className="flex gap-2 flex-1 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={setBudgetMutation.isPending}>
              {setBudgetMutation.isPending ? 'Saving...' : 'Save Budget'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Remove Budget AlertDialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the budget from "{category.name}"? This will end the current budget period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBudgetMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={removeBudgetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeBudgetMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ============================================
// BUDGET HISTORY DIALOG
// ============================================

interface BudgetHistoryDialogProps {
  categoryId: number;
}

function BudgetHistoryDialog({ categoryId }: BudgetHistoryDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Budget History</DialogTitle>
          <DialogDescription>
            View all budget changes for this category
          </DialogDescription>
        </DialogHeader>

        <BudgetHistoryContent categoryId={categoryId} />
      </DialogContent>
    </Dialog>
  );
}

function BudgetHistoryContent({ categoryId }: { categoryId: number }) {
  const { data: history, isLoading } = useBudgetHistory(categoryId);
  const deleteRecordMutation = useDeleteBudgetHistoryRecord();
  const deleteAllMutation = useDeleteAllBudgetHistory();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{ id: number; amount: string; dateRange: string } | null>(null);

  const handleDeleteRecord = (historyId: number, budgetAmount: string, effectiveFrom: string, effectiveTo: string | null) => {
    const dateRange = effectiveTo
      ? `${formatDate(effectiveFrom)} - ${formatDate(effectiveTo)}`
      : `${formatDate(effectiveFrom)} - Present`;

    setRecordToDelete({ id: historyId, amount: budgetAmount, dateRange });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteRecord = () => {
    if (!recordToDelete) return;

    deleteRecordMutation.mutate(recordToDelete.id, {
      onSuccess: () => {
        toast.success('Budget history record deleted');
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleDeleteAll = () => {
    setDeleteAllDialogOpen(true);
  };

  const confirmDeleteAll = () => {
    deleteAllMutation.mutate(categoryId, {
      onSuccess: () => {
        toast.success('All budget history deleted');
        setDeleteAllDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const previousCount = history?.filter(h => h.effectiveTo).length || 0;
  const activeCount = history?.filter(h => !h.effectiveTo).length || 0;

  if (isLoading) {
    return <p className="text-center text-muted-foreground">Loading history...</p>;
  }

  if (!history || history.length === 0) {
    return <p className="text-center text-muted-foreground">No budget history</p>;
  }

  const hasPreviousRecords = history.some(h => h.effectiveTo);

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-3">
          {history.map((record) => (
            <div key={record.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="font-medium">
                    {formatCurrency(parseFloat(record.budgetAmount))} / {record.budgetPeriod}
                  </div>
                  <Badge variant={record.effectiveTo ? 'secondary' : 'default'}>
                    {record.effectiveTo ? 'Previous' : 'Active'}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteRecord(record.id, record.budgetAmount, record.effectiveFrom, record.effectiveTo)}
                  disabled={deleteRecordMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Effective:</strong> {formatDate(record.effectiveFrom)}
                  {record.effectiveTo && ` - ${formatDate(record.effectiveTo)}`}
                </p>
                {record.notes && (
                  <p>
                    <strong>Notes:</strong> {record.notes}
                  </p>
                )}
                <p className="text-xs">
                  Created: {formatDate(record.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {hasPreviousRecords && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Budget History
            </Button>
          </div>
        )}
      </div>

      {/* Delete Single Record Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete budget ₪{recordToDelete ? parseFloat(recordToDelete.amount).toFixed(0) : '0'} ({recordToDelete?.dateRange})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRecordMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRecord}
              disabled={deleteRecordMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRecordMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Budget History</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {history?.length} budget record{history?.length !== 1 ? 's' : ''}
              {previousCount > 0 && ` (${previousCount} previous, ${activeCount} active)`}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAll}
              disabled={deleteAllMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAllMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
