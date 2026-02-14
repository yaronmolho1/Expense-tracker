'use client';

import { CollapsibleFilter } from '@/components/ui/collapsible-filter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { useMemo } from 'react';
import { Filter as FilterIcon, X, CreditCard, GitCompare } from 'lucide-react';
import { FILTER_STYLES } from '@/lib/constants/filter-styles';
import { cn } from '@/lib/utils';

export interface ReportsFilterState {
  dateFrom: string;
  dateTo: string;
  cardIds: string[];
  parentCategoryIds: string[];
  /** When set, enables comparison mode with this secondary period */
  comparisonDateFrom?: string;
  comparisonDateTo?: string;
}

interface ReportsFiltersProps {
  filters: ReportsFilterState;
  onFilterChange: (filters: ReportsFilterState) => void;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addYears(d: Date, n: number) {
  return new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
}

// ─── Preset definitions ─────────────────────────────────────────────────────

type PresetId = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'this_year' | 'last_year' | 'last_12m' | 'custom';

interface Preset {
  id: PresetId;
  label: string;
  getRange: (now: Date) => { from: string; to: string };
  /** Returns the "previous equivalent" period for comparison */
  getComparisonRange: (now: Date) => { from: string; to: string };
}

const PRESETS: Preset[] = [
  {
    id: 'this_month',
    label: 'This Month',
    getRange: (now) => ({ from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) }),
    getComparisonRange: (now) => {
      const prev = addMonths(now, -1);
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) };
    },
  },
  {
    id: 'last_month',
    label: 'Last Month',
    getRange: (now) => {
      const lm = addMonths(now, -1);
      return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) };
    },
    getComparisonRange: (now) => {
      const prev = addMonths(now, -2);
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) };
    },
  },
  {
    id: 'last_3m',
    label: 'Last 3M',
    getRange: (now) => ({ from: fmt(startOfMonth(addMonths(now, -2))), to: fmt(endOfMonth(now)) }),
    getComparisonRange: (now) => ({
      from: fmt(startOfMonth(addMonths(now, -5))),
      to: fmt(endOfMonth(addMonths(now, -3))),
    }),
  },
  {
    id: 'last_6m',
    label: 'Last 6M',
    getRange: (now) => ({ from: fmt(startOfMonth(addMonths(now, -5))), to: fmt(endOfMonth(now)) }),
    getComparisonRange: (now) => ({
      from: fmt(startOfMonth(addMonths(now, -11))),
      to: fmt(endOfMonth(addMonths(now, -6))),
    }),
  },
  {
    id: 'this_year',
    label: 'This Year',
    getRange: (now) => ({
      from: fmt(new Date(now.getFullYear(), 0, 1)),
      to: fmt(new Date(now.getFullYear(), 11, 31)),
    }),
    getComparisonRange: (now) => ({
      from: fmt(new Date(now.getFullYear() - 1, 0, 1)),
      to: fmt(new Date(now.getFullYear() - 1, 11, 31)),
    }),
  },
  {
    id: 'last_year',
    label: 'Last Year',
    getRange: (now) => ({
      from: fmt(new Date(now.getFullYear() - 1, 0, 1)),
      to: fmt(new Date(now.getFullYear() - 1, 11, 31)),
    }),
    getComparisonRange: (now) => ({
      from: fmt(new Date(now.getFullYear() - 2, 0, 1)),
      to: fmt(new Date(now.getFullYear() - 2, 11, 31)),
    }),
  },
  {
    id: 'last_12m',
    label: 'Last 12M',
    getRange: (now) => ({ from: fmt(startOfMonth(addMonths(now, -11))), to: fmt(endOfMonth(now)) }),
    getComparisonRange: (now) => ({
      from: fmt(startOfMonth(addMonths(now, -23))),
      to: fmt(endOfMonth(addMonths(now, -12))),
    }),
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectActivePreset(filters: ReportsFilterState, now: Date): PresetId {
  for (const preset of PRESETS) {
    const range = preset.getRange(now);
    if (range.from === filters.dateFrom && range.to === filters.dateTo) return preset.id;
  }
  return 'custom';
}

export function getDefaultReportsFilters(): ReportsFilterState {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const to = endOfMonth(now);
  return {
    dateFrom: fmt(from),
    dateTo: fmt(to),
    cardIds: [],
    parentCategoryIds: [],
  };
}

function formatDateLabel(date: string) {
  const [y, m] = date.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportsFilters({ filters, onFilterChange }: ReportsFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions();
  const now = useMemo(() => new Date(), []);

  const activePreset = useMemo(() => detectActivePreset(filters, now), [filters, now]);
  const hasComparison = !!filters.comparisonDateFrom;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.cardIds?.length) count += filters.cardIds.length;
    if (filters.parentCategoryIds?.length) count += filters.parentCategoryIds.length;
    return count;
  }, [filters]);

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getRange(now);
    // Preserve comparison if already on — re-derive for new preset
    if (hasComparison) {
      const cmp = preset.getComparisonRange(now);
      onFilterChange({
        ...filters,
        dateFrom: range.from,
        dateTo: range.to,
        comparisonDateFrom: cmp.from,
        comparisonDateTo: cmp.to,
      });
    } else {
      onFilterChange({ ...filters, dateFrom: range.from, dateTo: range.to });
    }
  };

  const handleComparisonToggle = () => {
    if (hasComparison) {
      // Turn off
      onFilterChange({ ...filters, comparisonDateFrom: undefined, comparisonDateTo: undefined });
    } else {
      // Turn on — derive from active preset or shift back
      const activeP = PRESETS.find((p) => p.id === activePreset);
      if (activeP) {
        const cmp = activeP.getComparisonRange(now);
        onFilterChange({ ...filters, comparisonDateFrom: cmp.from, comparisonDateTo: cmp.to });
      } else {
        // Custom range — shift the whole period back by its own length
        const msFrom = new Date(filters.dateFrom).getTime();
        const msTo = new Date(filters.dateTo).getTime();
        const span = msTo - msFrom;
        const cmpTo = new Date(msFrom - 86400000);
        const cmpFrom = new Date(cmpTo.getTime() - span);
        onFilterChange({
          ...filters,
          comparisonDateFrom: fmt(cmpFrom),
          comparisonDateTo: fmt(cmpTo),
        });
      }
    }
  };

  const handleClearFilters = () => {
    onFilterChange(getDefaultReportsFilters());
  };

  const header = (
    <>
      <FilterIcon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">Filters</span>
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className={FILTER_STYLES.badge}>
          {activeFilterCount}
        </Badge>
      )}
      {hasComparison && (
        <Badge variant="outline" className="text-xs gap-1">
          <GitCompare className="h-3 w-3" /> Comparing
        </Badge>
      )}
    </>
  );

  return (
    <CollapsibleFilter
      header={header}
      defaultOpen={true}
      sticky={true}
      className={cn(
        FILTER_STYLES.card.default,
        (activeFilterCount > 0 || hasComparison) && FILTER_STYLES.card.active
      )}
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-2">Loading filters...</div>
      ) : (
        <div className={FILTER_STYLES.spacing}>
          {/* ── Preset chips ── */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  activePreset === preset.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                )}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => {
                // Switch to custom — keep current dates, just deactivate preset visual
                // Already "custom" if no preset matches; nothing to do except signal UI
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                activePreset === 'custom'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              )}
            >
              Custom
            </button>
          </div>

          {/* ── Date pickers (always visible for precise control) ── */}
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

          {/* ── Comparison toggle ── */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Compare to previous period</p>
                {hasComparison && filters.comparisonDateFrom && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateLabel(filters.comparisonDateFrom)} – {formatDateLabel(filters.comparisonDateTo!)}
                  </p>
                )}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={hasComparison}
              onClick={handleComparisonToggle}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                hasComparison ? 'bg-primary' : 'bg-input'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform',
                  hasComparison ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* ── Category + Card filters ── */}
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
              onChange={(selected) => onFilterChange({ ...filters, parentCategoryIds: selected })}
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
      )}
    </CollapsibleFilter>
  );
}
