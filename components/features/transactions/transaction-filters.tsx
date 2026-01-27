'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useMemo } from 'react';
import { MultiSelect } from '@/components/ui/multi-select';
import { SortPopover, type SortOption } from '@/components/ui/sort-popover';
import { Filter, X, CreditCard } from 'lucide-react';
import { FILTER_STYLES } from '@/lib/constants/filter-styles';
import { cn } from '@/lib/utils';

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

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.businessIds?.length) count += filters.businessIds.length;
    if (filters.parentCategoryIds?.length) count += filters.parentCategoryIds.length;
    if (filters.childCategoryIds?.length) count += filters.childCategoryIds.length;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.cardIds?.length) count += filters.cardIds.length;
    if (filters.transactionTypes?.length) count += filters.transactionTypes.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.uncategorized) count++;
    return count;
  }, [filters]);

  // Sort options for popover
  const sortOptions: SortOption[] = [
    { value: 'bank_charge_date:desc', label: 'Date (Newest first)' },
    { value: 'bank_charge_date:asc', label: 'Date (Oldest first)' },
    { value: 'charged_amount_ils:desc', label: 'Amount (High to Low)' },
    { value: 'charged_amount_ils:asc', label: 'Amount (Low to High)' },
    { value: 'business_name:asc', label: 'Business (A-Z)' },
    { value: 'business_name:desc', label: 'Business (Z-A)' },
  ];

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
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className={FILTER_STYLES.badge}>
                {activeFilterCount}
              </Badge>
            )}
          </div>
          <SortPopover
            value={filters.sortBy || 'bank_charge_date:desc'}
            options={sortOptions}
            onChange={(value) => onFilterChange({ ...filters, sortBy: value })}
          />
        </div>
      </CardHeader>

      <CardContent className={FILTER_STYLES.content}>
        <div className={FILTER_STYLES.spacing}>
          {/* Row 1: Business, Main Category */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
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

            <MultiSelect
              icon={<Filter className="h-4 w-4" />}
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

          {/* Row 2: Sub Category, Card */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
            <MultiSelect
              icon={<Filter className="h-4 w-4" />}
              groupedOptions={groupedChildCategories}
              selected={filters.childCategoryIds || []}
              onChange={(selected) =>
                onFilterChange({ ...filters, childCategoryIds: selected })
              }
              placeholder={groupedChildCategories.length === 0 ? "Select main category first" : "All sub-categories"}
              emptyMessage="No sub-categories found."
              disabled={groupedChildCategories.length === 0 || filters.uncategorized}
            />

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

          {/* Row 3: Date Range */}
          <DateRangePicker
            fromValue={filters.dateFrom}
            toValue={filters.dateTo}
            onFromChange={(date) => onFilterChange({ ...filters, dateFrom: date })}
            onToChange={(date) => onFilterChange({ ...filters, dateTo: date })}
            fromLabel="From"
            toLabel="To"
            fromPlaceholder="DD/MM/YYYY"
            toPlaceholder="DD/MM/YYYY"
          />

          {/* Row 4: Transaction Type, Status */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
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
