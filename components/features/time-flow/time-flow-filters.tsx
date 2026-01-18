'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useMemo } from 'react';

interface TimeFlowFiltersProps {
  filters: {
    monthsBack: number;
    monthsForward: number;
    cardIds: string[];
    parentCategoryIds: string[];
    childCategoryIds: string[];
    uncategorized: boolean;
  };
  onFilterChange: (filters: any) => void;
}

export function TimeFlowFilters({ filters, onFilterChange }: TimeFlowFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions();

  // Get child categories grouped by parent
  const groupedChildCategories = useMemo(() => {
    if (!filters.parentCategoryIds?.length || !filterOptions) return [];
    const groups: Array<{ group: string; options: Array<{ value: string; label: string }> }> = [];

    filters.parentCategoryIds.forEach((parentId) => {
      const parent = filterOptions.categories.tree.find(
        (cat) => cat.value?.toString() === parentId
      );
      if (parent?.children && parent.children.length > 0) {
        groups.push({
          group: parent.name,
          options: parent.children.map((child) => ({
            value: child.value.toString(),
            label: child.label,
          })),
        });
      }
    });
    return groups;
  }, [filters.parentCategoryIds, filterOptions]);

  const handleClearFilters = () => {
    onFilterChange({
      monthsBack: 6,
      monthsForward: 6,
      cardIds: [],
      parentCategoryIds: [],
      childCategoryIds: [],
      uncategorized: false,
    });
  };

  if (isLoading) {
    return (
      <Card className="p-4 mb-6">
        <div className="text-sm text-muted-foreground">Loading filters...</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-6">
      <div className="space-y-4">
        {/* Row 1: Months Back, Months Forward, Card, Clear Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Months Back */}
          <div>
            <label className="text-sm font-medium mb-2 block">Months Back</label>
            <Input
              type="number"
              min="1"
              max="24"
              value={filters.monthsBack}
              onChange={(e) =>
                onFilterChange({ ...filters, monthsBack: parseInt(e.target.value) || 6 })
              }
            />
          </div>

          {/* Months Forward */}
          <div>
            <label className="text-sm font-medium mb-2 block">Months Forward</label>
            <Input
              type="number"
              min="0"
              max="24"
              value={filters.monthsForward}
              onChange={(e) =>
                onFilterChange({ ...filters, monthsForward: parseInt(e.target.value) || 6 })
              }
            />
          </div>

          {/* Card Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Card</label>
            <MultiSelect
              options={filterOptions?.cards.map((card) => ({
                value: card.value.toString(),
                label: card.label,
              })) || []}
              selected={filters.cardIds || []}
              onChange={(selected) =>
                onFilterChange({ ...filters, cardIds: selected })
              }
              placeholder="All cards"
              emptyMessage="No cards found."
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Row 2: Main Category, Sub Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Main Category */}
          <div>
            <label className="text-sm font-medium mb-2 block">Main Category</label>
            <MultiSelect
              options={[
                ...(filterOptions?.categories.parents.map((cat) => ({
                  value: cat.value.toString(),
                  label: cat.label,
                })) || []),
                { value: '__uncategorized__', label: 'Uncategorized' }
              ]}
              selected={filters.uncategorized ? ['__uncategorized__'] : (filters.parentCategoryIds || [])}
              onChange={(selected) => {
                if (selected.includes('__uncategorized__')) {
                  onFilterChange({
                    ...filters,
                    parentCategoryIds: [],
                    childCategoryIds: [],
                    uncategorized: true,
                  });
                } else {
                  onFilterChange({
                    ...filters,
                    parentCategoryIds: selected,
                    childCategoryIds: [],
                    uncategorized: false,
                  });
                }
              }}
              placeholder="All categories"
              emptyMessage="No categories found."
            />
          </div>

          {/* Sub Category */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sub Category</label>
            <MultiSelect
              groupedOptions={groupedChildCategories}
              selected={filters.childCategoryIds || []}
              onChange={(selected) =>
                onFilterChange({ ...filters, childCategoryIds: selected })
              }
              placeholder={groupedChildCategories.length === 0 ? "Select main category first" : "All sub-categories"}
              emptyMessage="No sub-categories found."
              disabled={groupedChildCategories.length === 0 || filters.uncategorized}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
