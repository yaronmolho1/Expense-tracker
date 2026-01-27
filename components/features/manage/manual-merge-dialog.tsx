'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Plus, ChevronLeft } from 'lucide-react';
import { useBusinesses, useMergeBusinesses, useCreateBusiness } from '@/hooks/use-businesses';

interface CategoryTree {
  id: number;
  name: string;
  children: Array<{
    id: number;
    name: string;
    parentId: number;
  }>;
}

interface Business {
  id: number;
  normalized_name: string;
  display_name: string;
  transaction_count: number;
  total_spent: number;
}

interface ManualMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBusinessIds?: number[]; // NEW: Optional preselected businesses
  onSuccess?: () => void; // NEW: Callback after successful merge
}

export function ManualMergeDialog({
  open,
  onOpenChange,
  preselectedBusinessIds = [],
  onSuccess
}: ManualMergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusinesses, setSelectedBusinesses] = useState<Business[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessPrimaryCategory, setNewBusinessPrimaryCategory] = useState<string>('');
  const [newBusinessChildCategory, setNewBusinessChildCategory] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Only fetch when search query is not empty
  const { data: searchResults } = useBusinesses(
    { search: searchQuery },
    { enabled: searchQuery.trim().length > 0 }
  );

  // NEW: Fetch preselected businesses when dialog opens
  const { data: allBusinesses } = useBusinesses(
    {},
    { enabled: preselectedBusinessIds.length > 0 && open }
  );

  const mergeBusinesses = useMergeBusinesses();
  const createBusiness = useCreateBusiness();

  // Fetch categories when dialog opens
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      return data.categories as CategoryTree[];
    },
    enabled: open, // Only fetch when dialog is open
  });

  // Get child categories for selected parent
  const selectedParentCategory = categoriesData?.find((c) => c.id.toString() === newBusinessPrimaryCategory);
  const childCategories = selectedParentCategory?.children || [];

  // NEW: Load preselected businesses when dialog opens
  useEffect(() => {
    if (open && preselectedBusinessIds.length > 0 && allBusinesses) {
      const preselected = allBusinesses.businesses.filter(b =>
        preselectedBusinessIds.includes(b.id)
      );
      setSelectedBusinesses(preselected);
      setSelectedTargetId(null); // NO pre-selection of target
    } else if (!open) {
      // Reset when closing
      setSelectedBusinesses([]);
      setSelectedTargetId(null);
      setSearchQuery('');
      setShowResults(false);
      setShowCreateNew(false);
      setNewBusinessName('');
      setNewBusinessPrimaryCategory('');
      setNewBusinessChildCategory('');
    }
  }, [open, preselectedBusinessIds, allBusinesses]);

  // Maintain focus on search input when results update
  useEffect(() => {
    if (searchInputRef.current && document.activeElement !== searchInputRef.current && showResults) {
      searchInputRef.current.focus();
    }
  }, [searchResults, showResults]);

  const handleAddBusiness = (business: Business) => {
    if (!selectedBusinesses.find(b => b.id === business.id)) {
      setSelectedBusinesses(prev => [...prev, business]);
    }
    // Don't clear search - let user keep selecting from same results
  };

  const handleRemoveBusiness = (businessId: number) => {
    setSelectedBusinesses(prev => prev.filter(b => b.id !== businessId));
    if (selectedTargetId === businessId) {
      setSelectedTargetId(null);
    }
  };

  const handleConfirmMerge = async () => {
    // Check if user selected "Create New" option
    if (selectedTargetId === -1) {
      // Create new business first
      if (!newBusinessName.trim() || !newBusinessPrimaryCategory) {
        return;
      }

      try {
        const result = await createBusiness.mutateAsync({
          name: newBusinessName.trim(),
          primaryCategoryId: parseInt(newBusinessPrimaryCategory),
          childCategoryId: newBusinessChildCategory ? parseInt(newBusinessChildCategory) : undefined,
        });

        // Now merge into the newly created business
        await mergeBusinesses.mutateAsync({
          targetId: result.business.id,
          businessIds: [...selectedBusinesses.map(b => b.id), result.business.id],
        });

        // Reset state
        setSelectedBusinesses([]);
        setSelectedTargetId(null);
        setSearchQuery('');
        setShowCreateNew(false);
        setNewBusinessName('');
        setNewBusinessPrimaryCategory('');
        setNewBusinessChildCategory('');
        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        console.error('Failed to create business and merge:', error);
      }
    } else {
      // Regular merge
      if (!selectedTargetId || selectedBusinesses.length < 2) return;

      try {
        await mergeBusinesses.mutateAsync({
          targetId: selectedTargetId,
          businessIds: selectedBusinesses.map(b => b.id),
        });
        // Reset state
        setSelectedBusinesses([]);
        setSelectedTargetId(null);
        setSearchQuery('');
        onOpenChange(false);
        // Call success callback to clear selections in parent
        onSuccess?.();
      } catch (error) {
        console.error('Failed to merge businesses:', error);
      }
    }
  };

  const handleCancel = () => {
    setSelectedBusinesses([]);
    setSelectedTargetId(null);
    setSearchQuery('');
    setShowResults(false);
    setShowCreateNew(false);
    setNewBusinessName('');
    setNewBusinessPrimaryCategory('');
    setNewBusinessChildCategory('');
    onOpenChange(false);
  };

  const availableResults = searchResults?.businesses.filter(
    b => !selectedBusinesses.find(sb => sb.id === b.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          {showCreateNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateNew(false);
                setNewBusinessName('');
                setNewBusinessPrimaryCategory('');
                setNewBusinessChildCategory('');
                setSelectedTargetId(null);
              }}
              className="w-fit mb-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to selection
            </Button>
          )}
          <DialogTitle>
            {showCreateNew ? 'Create New Business to Merge Into' : 'Manual Business Merge'}
          </DialogTitle>
          <DialogDescription>
            {showCreateNew
              ? 'Enter details for the new business that will be the merge target'
              : 'Search and add businesses to merge, then select which one to keep'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Business Form */}
          {showCreateNew ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  placeholder="Enter business name..."
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Main Category</Label>
                {!categoriesData ? (
                  <div className="text-sm text-muted-foreground">Loading categories...</div>
                ) : (
                  <Select
                    value={newBusinessPrimaryCategory}
                    onValueChange={(value) => {
                      setNewBusinessPrimaryCategory(value);
                      setNewBusinessChildCategory(''); // Reset child when parent changes
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {categoriesData.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Subcategory (Optional)</Label>
                {!categoriesData ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : (
                  <Select
                    value={newBusinessChildCategory}
                    onValueChange={setNewBusinessChildCategory}
                    disabled={!newBusinessPrimaryCategory || childCategories.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={childCategories.length === 0 ? "Select main category first" : "Select subcategory"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {childCategories.length > 0 ? (
                        childCategories.map((child) => (
                          <SelectItem key={child.id} value={child.id.toString()}>
                            {child.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">No subcategories</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Show selected businesses that will be merged */}
              {selectedBusinesses.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>
                    Businesses to merge into new business ({selectedBusinesses.length})
                  </Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedBusinesses.map((business) => (
                      <div
                        key={business.id}
                        className="p-3 border rounded-lg bg-accent/50"
                      >
                        <div className="font-medium">{business.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {business.normalized_name} · {business.transaction_count} transactions · ₪
                          {business.total_spent.toLocaleString('en-IL')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Search Section */}
              <div className="space-y-2">
            <Label>Search for businesses to merge</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Type business name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(e.target.value.length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setShowResults(false);
                  }
                }}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Search Results Dropdown */}
            {showResults && availableResults.length > 0 && (
              <div className="border rounded-lg max-h-[200px] overflow-y-auto bg-white shadow-lg">
                {availableResults.slice(0, 10).map((business) => (
                  <div
                    key={business.id}
                    className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                    onClick={() => handleAddBusiness(business)}
                  >
                    <div className="font-medium">{business.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {business.normalized_name} · {business.transaction_count} transactions · ₪
                      {business.total_spent.toLocaleString('en-IL')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Businesses */}
          {selectedBusinesses.length > 0 && (
            <div className="space-y-2">
              <Label>
                Businesses to merge ({selectedBusinesses.length})
                {selectedBusinesses.length < 2 && (
                  <span className="text-muted-foreground ml-2 text-sm">
                    (Add at least 2 to merge)
                  </span>
                )}
              </Label>
              <div className="space-y-2">
                {selectedBusinesses.map((business) => (
                  <div
                    key={business.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-accent/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{business.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {business.normalized_name} · {business.transaction_count} transactions · ₪
                        {business.total_spent.toLocaleString('en-IL')}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveBusiness(business.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Selection */}
          {selectedBusinesses.length >= 2 && (
            <div className="space-y-2">
              <Label>Select which business to keep</Label>
              <RadioGroup
                value={selectedTargetId?.toString()}
                onValueChange={(value) => setSelectedTargetId(parseInt(value))}
              >
                <div className="space-y-2">
                  {/* Create New Business Option */}
                  <div
                    className="flex items-start space-x-3 border-2 border-dashed border-primary rounded-lg p-4 hover:bg-accent cursor-pointer"
                    onClick={() => {
                      setSelectedTargetId(-1);
                      setShowCreateNew(true);
                    }}
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-primary bg-primary/10 mt-0.5">
                      <Plus className="h-3 w-3 text-primary" />
                    </div>
                    <Label className="flex-1 cursor-pointer">
                      <div className="font-semibold text-primary">Create New Business</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Merge all selected businesses into a new business with a custom name and category
                      </div>
                    </Label>
                  </div>

                  {selectedBusinesses.map((business) => (
                    <div
                      key={business.id}
                      className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent"
                    >
                      <RadioGroupItem
                        value={business.id.toString()}
                        id={`target-${business.id}`}
                      />
                      <Label htmlFor={`target-${business.id}`} className="flex-1 cursor-pointer">
                        <div className="font-semibold">{business.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Normalized: {business.normalized_name}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {business.transaction_count} transactions · ₪
                          {business.total_spent.toLocaleString('en-IL')}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMerge}
            disabled={
              showCreateNew
                ? !newBusinessName.trim() || !newBusinessPrimaryCategory || createBusiness.isPending || mergeBusinesses.isPending
                : selectedBusinesses.length < 2 || !selectedTargetId || mergeBusinesses.isPending
            }
          >
            {createBusiness.isPending || mergeBusinesses.isPending
              ? showCreateNew
                ? 'Creating & Merging...'
                : 'Merging...'
              : showCreateNew
              ? 'Create & Merge'
              : 'Merge Businesses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
