import type { CategoryMeta } from '@/lib/services/reports-service';

// All 10 chart CSS variables — perceptually distinct hues, dark-mode aware
const ALL_COLORS = [
  'var(--chart-1)',   // orange
  'var(--chart-2)',   // cyan
  'var(--chart-3)',   // blue
  'var(--chart-4)',   // green
  'var(--chart-5)',   // yellow
  'var(--chart-6)',   // red
  'var(--chart-7)',   // violet
  'var(--chart-8)',   // rose/pink
  'var(--chart-9)',   // teal
  'var(--chart-10)',  // amber
];

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
