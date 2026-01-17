'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
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
import { Search, Filter } from 'lucide-react';

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
      <Card className="p-4 mb-6">
        <div className="text-sm text-muted-foreground">Loading filters...</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-6">
      <div className="space-y-4">
        {/* Row 1: Search, Approval Status, Sort */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search businesses..."
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          {/* Approval Status */}
          <div>
            <label className="text-sm font-medium mb-2 block">Approval Status</label>
            <Select
              value={filters.approvalFilter}
              onValueChange={(v: ApprovalFilter) => onFilterChange({ approvalFilter: v })}
            >
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
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

          {/* Sort */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <Select
              value={`${filters.sortField}:${filters.sortDirection}`}
              onValueChange={(v) => {
                const [field, dir] = v.split(':');
                onFilterChange({
                  sortField: field as SortField,
                  sortDirection: dir as SortDirection
                });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name:asc">Name (A-Z)</SelectItem>
                <SelectItem value="name:desc">Name (Z-A)</SelectItem>
                <SelectItem value="transaction_count:desc">Transactions (High-Low)</SelectItem>
                <SelectItem value="transaction_count:asc">Transactions (Low-High)</SelectItem>
                <SelectItem value="total_spent:desc">Total Spent (High-Low)</SelectItem>
                <SelectItem value="total_spent:asc">Total Spent (Low-High)</SelectItem>
                <SelectItem value="last_used_date:desc">Last Used (Recent First)</SelectItem>
                <SelectItem value="last_used_date:asc">Last Used (Oldest First)</SelectItem>
                <SelectItem value="primary_category:asc">Category (A-Z)</SelectItem>
                <SelectItem value="primary_category:desc">Category (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Category Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Main Category - EXACT logic from transaction-filters.tsx lines 106-137 */}
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
          </div>

          {/* Sub Category - EXACT logic from transaction-filters.tsx lines 139-152 */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sub Category</label>
            <MultiSelect
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
        </div>

        {/* Row 3: Date Range & Actions */}
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <DateRangePicker
                fromValue={filters.dateFrom}
                toValue={filters.dateTo}
                onFromChange={(date) => onFilterChange({ dateFrom: date })}
                onToChange={(date) => onFilterChange({ dateTo: date })}
                fromLabel="Has Transactions From"
                toLabel="To"
                fromPlaceholder="DD/MM/YYYY"
                toPlaceholder="DD/MM/YYYY"
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
        </div>
      </div>
    </Card>
  );
}
