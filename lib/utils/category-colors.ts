import type { CategoryMeta } from '@/lib/services/reports-service';

// Use the existing CSS chart variables first, then extend with additional hues
const CHART_VARS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const EXTENDED_PALETTE = [
  'hsl(280 55% 60%)',  // soft purple
  'hsl(160 45% 50%)',  // muted green
  'hsl(340 50% 58%)',  // dusty rose
  'hsl(200 55% 52%)',  // sky blue
  'hsl(25 65% 55%)',   // warm terracotta
];

const ALL_COLORS = [...CHART_VARS, ...EXTENDED_PALETTE];

/**
 * Build a stable Map<categoryId → colorString> based on displayOrder.
 * Pass the categoryMeta array from ReportsResponse.
 */
export function buildCategoryColorMap(categoryMeta: CategoryMeta[]): Map<number, string> {
  const sorted = [...categoryMeta].sort((a, b) => a.displayOrder - b.displayOrder);
  const map = new Map<number, string>();
  sorted.forEach((cat, index) => {
    map.set(cat.categoryId, ALL_COLORS[index % ALL_COLORS.length]);
  });
  return map;
}

export function getCategoryColor(colorMap: Map<number, string>, categoryId: number): string {
  return colorMap.get(categoryId) ?? 'hsl(var(--muted-foreground))';
}
