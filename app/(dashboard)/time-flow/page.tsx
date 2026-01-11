'use client';

import { useState } from 'react';
import { useTimeFlow } from '@/hooks/use-time-flow';
import { TimeFlowFilters } from '@/components/features/time-flow/time-flow-filters';
import { TimeFlowTable } from '@/components/features/time-flow/time-flow-table';
import { CellDetailModal } from '@/components/features/time-flow/cell-detail-modal';
import { Loader2 } from 'lucide-react';

export default function TimeFlowPage() {
  const [filters, setFilters] = useState({
    monthsBack: 6,
    monthsForward: 6,
    cardIds: [] as string[],
  });

  const [selectedCell, setSelectedCell] = useState<{
    categoryId: number;
    subCategoryId: number | null;
    month: string;
    categoryName: string;
    subCategoryName: string;
  } | null>(null);

  const { data, isLoading, error } = useTimeFlow(filters);

  const handleCellClick = (categoryId: number, subCategoryId: number | null, month: string) => {
    if (!data) return;

    const category = data.categories.find((c) => c.mainCategoryId === categoryId);
    if (!category) return;

    const subCategory = category.subCategories.find((s) => s.subCategoryId === subCategoryId);

    setSelectedCell({
      categoryId,
      subCategoryId,
      month,
      categoryName: category.mainCategoryName,
      subCategoryName: subCategory?.subCategoryName || 'Uncategorized',
    });
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">
          Error loading time-flow data: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Time Flow Analysis</h1>

      <TimeFlowFilters filters={filters} onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <TimeFlowTable
          months={data.months}
          categories={data.categories}
          columnTotals={data.columnTotals}
          grandTotal={data.grandTotal}
          onCellClick={handleCellClick}
        />
      ) : null}

      {selectedCell && (
        <CellDetailModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          categoryId={selectedCell.categoryId}
          subCategoryId={selectedCell.subCategoryId}
          month={selectedCell.month}
          categoryName={selectedCell.categoryName}
          subCategoryName={selectedCell.subCategoryName}
        />
      )}
    </div>
  );
}
