'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useMemo } from 'react';
import { Filter as FilterIcon, X, CreditCard, Calendar } from 'lucide-react';
import { FILTER_STYLES } from '@/lib/constants/filter-styles';
import { cn } from '@/lib/utils';

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

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Don't count monthsBack/monthsForward as they have default values
    if (filters.cardIds?.length) count += filters.cardIds.length;
    if (filters.parentCategoryIds?.length) count += filters.parentCategoryIds.length;
    if (filters.childCategoryIds?.length) count += filters.childCategoryIds.length;
    if (filters.uncategorized) count++;
    return count;
  }, [filters]);

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
      <Card className={FILTER_STYLES.card.default}>
        <CardContent className={FILTER_STYLES.content}>
          <div className="text-sm text-muted-foreground">Loading filters...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      FILTER_STYLES.card.default,
      activeFilterCount > 0 && FILTER_STYLES.card.active
    )}>
      <CardHeader className={FILTER_STYLES.header}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className={FILTER_STYLES.badge}>
                {activeFilterCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={FILTER_STYLES.content}>
        <div className={FILTER_STYLES.spacing}>
          {/* Row 1: Months Back, Months Forward */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
            <div className="space-y-2">
              <Label htmlFor="months-back">Months Back</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  id="months-back"
                  type="number"
                  min="1"
                  max="24"
                  value={filters.monthsBack}
                  onChange={(e) =>
                    onFilterChange({ ...filters, monthsBack: parseInt(e.target.value) || 6 })
                  }
                  placeholder="Months back"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="months-forward">Months Forward</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  id="months-forward"
                  type="number"
                  min="0"
                  max="24"
                  value={filters.monthsForward}
                  onChange={(e) =>
                    onFilterChange({ ...filters, monthsForward: parseInt(e.target.value) || 6 })
                  }
                  placeholder="Months forward"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Main Category, Sub Category */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
            <MultiSelect
              icon={<FilterIcon className="h-4 w-4" />}
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

            <MultiSelect
              icon={<FilterIcon className="h-4 w-4" />}
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

          {/* Row 3: Card */}
          <div className={`grid grid-cols-1 ${FILTER_STYLES.gridGap}`}>
            <MultiSelect
              icon={<CreditCard className="h-4 w-4" />}
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
        </div>

        {/* Clear All - only when filters active */}
        {activeFilterCount > 0 && (
          <div className={`flex justify-end ${FILTER_STYLES.clearButton}`}>
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
