'use client';

import { CollapsibleFilter } from '@/components/ui/collapsible-filter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useMemo } from 'react';
import { Filter as FilterIcon, X, CreditCard } from 'lucide-react';
import { FILTER_STYLES } from '@/lib/constants/filter-styles';
import { cn } from '@/lib/utils';

export interface ReportsFilterState {
  dateFrom: string;
  dateTo: string;
  cardIds: string[];
  parentCategoryIds: string[];
}

interface ReportsFiltersProps {
  filters: ReportsFilterState;
  onFilterChange: (filters: ReportsFilterState) => void;
}

export function getDefaultReportsFilters(): ReportsFilterState {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0); // end of current month
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    dateFrom: fmt(from),
    dateTo: fmt(to),
    cardIds: [],
    parentCategoryIds: [],
  };
}

export function ReportsFilters({ filters, onFilterChange }: ReportsFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions();

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.cardIds?.length) count += filters.cardIds.length;
    if (filters.parentCategoryIds?.length) count += filters.parentCategoryIds.length;
    return count;
  }, [filters]);

  const handleClearFilters = () => {
    onFilterChange({
      ...getDefaultReportsFilters(),
    });
  };

  if (isLoading) {
    return (
      <CollapsibleFilter
        header={
          <>
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </>
        }
        defaultOpen={false}
        sticky={true}
        className={FILTER_STYLES.card.default}
      >
        <div className="text-sm text-muted-foreground">Loading filters...</div>
      </CollapsibleFilter>
    );
  }

  return (
    <CollapsibleFilter
      header={
        <>
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className={FILTER_STYLES.badge}>
              {activeFilterCount}
            </Badge>
          )}
        </>
      }
      defaultOpen={true}
      sticky={true}
      className={cn(
        FILTER_STYLES.card.default,
        activeFilterCount > 0 && FILTER_STYLES.card.active
      )}
    >
      <div className={FILTER_STYLES.spacing}>
        {/* Row 1: Date From, Date To */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
          <div className="space-y-2">
            <Label>From</Label>
            <MonthYearPicker
              value={filters.dateFrom}
              onChange={(date) => onFilterChange({ ...filters, dateFrom: date })}
            />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <MonthYearPicker
              value={filters.dateTo}
              onChange={(date) => onFilterChange({ ...filters, dateTo: date })}
            />
          </div>
        </div>

        {/* Row 2: Category, Card */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${FILTER_STYLES.gridGap}`}>
          <MultiSelect
            icon={<FilterIcon className="h-4 w-4" />}
            options={
              filterOptions?.categories.parents.map((cat) => ({
                value: cat.value.toString(),
                label: cat.label,
              })) || []
            }
            selected={filters.parentCategoryIds || []}
            onChange={(selected) =>
              onFilterChange({ ...filters, parentCategoryIds: selected })
            }
            placeholder="All categories"
            emptyMessage="No categories found."
          />

          <MultiSelect
            icon={<CreditCard className="h-4 w-4" />}
            options={
              filterOptions?.cards.map((card) => ({
                value: card.value.toString(),
                label: card.label,
              })) || []
            }
            selected={filters.cardIds || []}
            onChange={(selected) => onFilterChange({ ...filters, cardIds: selected })}
            placeholder="All cards"
            emptyMessage="No cards found."
          />
        </div>

        {activeFilterCount > 0 && (
          <div className={`flex justify-end ${FILTER_STYLES.clearButton}`}>
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        )}
      </div>
    </CollapsibleFilter>
  );
}
