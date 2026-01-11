'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
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

interface TransactionFiltersProps {
  filters: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    businessIds?: string[];
    parentCategoryIds?: string[];
    childCategoryIds?: string[];
    cardIds?: string[];
    transactionTypes?: string[];
    statuses?: string[];
    uncategorized?: boolean;
    sortBy?: string;
  };
  onFilterChange: (filters: any) => void;
}

export function TransactionFilters({ filters, onFilterChange }: TransactionFiltersProps) {
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
      search: '',
      dateFrom: '',
      dateTo: '',
      businessIds: [],
      parentCategoryIds: [],
      childCategoryIds: [],
      cardIds: [],
      transactionTypes: [],
      statuses: [],
      uncategorized: false,
      sortBy: 'bank_charge_date:desc',
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
        {/* Row 1: Business, Parent Category, Child Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Business */}
          <div>
            <label className="text-sm font-medium mb-2 block">Business</label>
            <MultiSelect
              options={filterOptions?.businesses.map((business) => ({
                value: business.value.toString(),
                label: business.label,
              })) || []}
              selected={filters.businessIds || []}
              onChange={(selected) =>
                onFilterChange({ ...filters, businessIds: selected })
              }
              placeholder="All businesses"
              emptyMessage="No businesses found."
            />
          </div>

          {/* Parent Category */}
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

          {/* Child Category */}
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

        {/* Row 2: Dates, Card, Type, Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date From */}
          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <DatePicker
              value={filters.dateFrom}
              onChange={(date) => onFilterChange({ ...filters, dateFrom: date })}
              placeholder="DD/MM/YYYY"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <DatePicker
              value={filters.dateTo}
              onChange={(date) => onFilterChange({ ...filters, dateTo: date })}
              placeholder="DD/MM/YYYY"
            />
          </div>

          {/* Card */}
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

          {/* Transaction Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Type</label>
            <MultiSelect
              options={filterOptions?.transactionTypes.map((type) => ({
                value: type.value.toString(),
                label: type.label,
              })) || []}
              selected={filters.transactionTypes || []}
              onChange={(selected) =>
                onFilterChange({ ...filters, transactionTypes: selected })
              }
              placeholder="All types"
              emptyMessage="No types found."
            />
          </div>
        </div>

        {/* Row 3: Status, Sort, Clear */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <MultiSelect
              options={filterOptions?.statuses.map((status) => ({
                value: status.value.toString(),
                label: status.label,
              })) || []}
              selected={filters.statuses || []}
              onChange={(selected) =>
                onFilterChange({ ...filters, statuses: selected })
              }
              placeholder="All statuses"
              emptyMessage="No statuses found."
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <Select
              value={filters.sortBy || 'bank_charge_date:desc'}
              onValueChange={(value) =>
                onFilterChange({ ...filters, sortBy: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_charge_date:desc">Date (Newest first)</SelectItem>
                <SelectItem value="bank_charge_date:asc">Date (Oldest first)</SelectItem>
                <SelectItem value="charged_amount_ils:desc">Amount (High to Low)</SelectItem>
                <SelectItem value="charged_amount_ils:asc">Amount (Low to High)</SelectItem>
                <SelectItem value="business_name:asc">Business (A-Z)</SelectItem>
                <SelectItem value="business_name:desc">Business (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Empty spacer */}
          <div></div>

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
    </Card>
  );
}
