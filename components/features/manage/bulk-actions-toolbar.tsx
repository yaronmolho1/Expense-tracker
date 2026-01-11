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
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground rounded-lg shadow-2xl p-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="font-medium">
        {selectedCount} {selectedCount === 1 ? 'business' : 'businesses'} selected
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBulkMerge}
          disabled={selectedCount < 2}
        >
          <GitMerge className="h-4 w-4 mr-2" />
          Bulk Merge
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onBulkSetCategory}
        >
          <Tag className="h-4 w-4 mr-2" />
          Set Category
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-primary-foreground/20"
        onClick={onClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
