'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { useFilterOptions } from '@/hooks/use-filter-options';

interface TimeFlowFiltersProps {
  filters: {
    monthsBack: number;
    monthsForward: number;
    cardIds: string[];
  };
  onFilterChange: (filters: any) => void;
}

export function TimeFlowFilters({ filters, onFilterChange }: TimeFlowFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions();

  const handleClearFilters = () => {
    onFilterChange({
      monthsBack: 6,
      monthsForward: 6,
      cardIds: [],
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
    </Card>
  );
}
