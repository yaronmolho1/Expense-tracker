'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useMemo } from 'react';
import { MultiSelect } from '@/components/ui/multi-select';
import { SortPopover, type SortOption } from '@/components/ui/sort-popover';
import { Search, Filter as FilterIcon, X, Tag } from 'lucide-react';
import { FILTER_STYLES } from '@/lib/constants/filter-styles';
import { cn } from '@/lib/utils';

type SortField = 'name' | 'transaction_count' | 'total_spent' | 'last_used_date' | 'primary_category';
type SortDirection = 'asc' | 'desc';
type ApprovalFilter = 'all' | 'approved' | 'unapproved' | 'uncategorized';

interface BusinessFiltersProps {
  filters: {
    search: string;
    approvalFilter: ApprovalFilter;
    sortField: SortField;
    sortDirection: SortDirection;
    parentCategoryIds: string[];
    childCategoryIds: string[];
    dateFrom: string;
    dateTo: string;
    uncategorized: boolean;
  };
  onFilterChange: (filters: Partial<BusinessFiltersProps['filters']>) => void;
}

export function BusinessFilters({ filters, onFilterChange }: BusinessFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions();

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.approvalFilter && filters.approvalFilter !== 'all') count++;
    if (filters.parentCategoryIds?.length) count += filters.parentCategoryIds.length;
    if (filters.childCategoryIds?.length) count += filters.childCategoryIds.length;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.uncategorized) count++;
    return count;
  }, [filters]);

  // Sort options for popover
  const sortOptions: SortOption[] = [
    { value: 'name:asc', label: 'Name (A-Z)' },
    { value: 'name:desc', label: 'Name (Z-A)' },
    { value: 'transaction_count:desc', label: 'Transactions (High-Low)' },
    { value: 'transaction_count:asc', label: 'Transactions (Low-High)' },
    { value: 'total_spent:desc', label: 'Total Spent (High-Low)' },
    { value: 'total_spent:asc', label: 'Total Spent (Low-High)' },
    { value: 'last_used_date:desc', label: 'Last Used (Recent First)' },
    { value: 'last_used_date:asc', label: 'Last Used (Oldest First)' },
    { value: 'primary_category:asc', label: 'Category (A-Z)' },
    { value: 'primary_category:desc', label: 'Category (Z-A)' },
  ];

  // Get child categories grouped by parent (EXACT logic from transaction-filters.tsx lines 38-57)
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
      search: '',
      approvalFilter: 'all',
      sortField: 'name',
      sortDirection: 'asc',
      parentCategoryIds: [],
      childCategoryIds: [],
      dateFrom: '',
      dateTo: '',
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
          <SortPopover
            value={`${filters.sortField}:${filters.sortDirection}`}
            options={sortOptions}
            onChange={(value) => {
              const [field, dir] = value.split(':');
              onFilterChange({
                sortField: field as SortField,
                sortDirection: dir as SortDirection
              });
            }}
          />
        </div>
      </CardHeader>

      <CardContent className={FILTER_STYLES.content}>
        <div className={FILTER_STYLES.spacing}>
          {/* Row 1: Search, Approval Status */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search businesses..."
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.approvalFilter}
              onValueChange={(v: ApprovalFilter) => onFilterChange({ approvalFilter: v })}
            >
              <SelectTrigger>
                <FilterIcon className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Businesses</SelectItem>
                <SelectItem value="approved">Approved Only</SelectItem>
                <SelectItem value="unapproved">Unapproved Only</SelectItem>
                <SelectItem value="uncategorized">Uncategorized Only</SelectItem>
              </SelectContent>
            </Select>
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
                    parentCategoryIds: [],
                    childCategoryIds: [],
                    uncategorized: true,
                  });
                } else {
                  onFilterChange({
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
                onFilterChange({ childCategoryIds: selected })
              }
              placeholder={groupedChildCategories.length === 0 ? "Select main category first" : "All sub-categories"}
              emptyMessage="No sub-categories found."
              disabled={groupedChildCategories.length === 0 || filters.uncategorized}
            />
          </div>

          {/* Row 3: Date Range */}
          <DateRangePicker
            fromValue={filters.dateFrom}
            toValue={filters.dateTo}
            onFromChange={(date) => onFilterChange({ dateFrom: date })}
            onToChange={(date) => onFilterChange({ dateTo: date })}
            fromLabel="From"
            toLabel="To"
            fromPlaceholder="DD/MM/YYYY"
            toPlaceholder="DD/MM/YYYY"
          />
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
