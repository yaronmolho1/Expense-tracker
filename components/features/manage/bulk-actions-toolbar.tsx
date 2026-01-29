'use client';

import { Button } from '@/components/ui/button';
import { GitMerge, Tag, X } from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onBulkMerge: () => void;
  onBulkSetCategory: () => void;
  onClear: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onBulkMerge,
  onBulkSetCategory,
  onClear,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground rounded-lg shadow-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 z-50 animate-in slide-in-from-bottom-5 w-[95vw] sm:w-auto max-w-[95vw]">
      <div className="font-medium text-sm sm:text-base whitespace-nowrap">
        {selectedCount} {selectedCount === 1 ? 'business' : 'businesses'} selected
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBulkMerge}
          disabled={selectedCount < 2}
          className="text-xs sm:text-sm"
        >
          <GitMerge className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden xs:inline">Bulk </span>Merge
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onBulkSetCategory}
          className="text-xs sm:text-sm"
        >
          <Tag className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden xs:inline">Set </span>Category
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary-foreground/20 absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto"
        onClick={onClear}
      >
        <X className="h-3 w-3 sm:h-4 sm:w-4" />
      </Button>
    </div>
  );
}
