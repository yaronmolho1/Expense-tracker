'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Search, X, Plus } from 'lucide-react';
import { useBusinesses, useMergeBusinesses } from '@/hooks/use-businesses';

interface Business {
  id: number;
  normalized_name: string;
  display_name: string;
  transaction_count: number;
  total_spent: number;
}

interface ManualMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualMergeDialog({ open, onOpenChange }: ManualMergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusinesses, setSelectedBusinesses] = useState<Business[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Only fetch when search query is not empty
  const { data: searchResults } = useBusinesses(
    searchQuery,
    undefined,
    undefined,
    undefined,
    { enabled: searchQuery.trim().length > 0 }
  );
  const mergeBusinesses = useMergeBusinesses();

  // Maintain focus on search input when results update
  useEffect(() => {
    if (searchInputRef.current && document.activeElement !== searchInputRef.current && showResults) {
      searchInputRef.current.focus();
    }
  }, [searchResults, showResults]);

  const handleAddBusiness = (business: Business) => {
    if (!selectedBusinesses.find(b => b.id === business.id)) {
      setSelectedBusinesses(prev => [...prev, business]);
    }
    // Don't clear search - let user keep selecting from same results
  };

  const handleRemoveBusiness = (businessId: number) => {
    setSelectedBusinesses(prev => prev.filter(b => b.id !== businessId));
    if (selectedTargetId === businessId) {
      setSelectedTargetId(null);
    }
  };

  const handleConfirmMerge = async () => {
    if (!selectedTargetId || selectedBusinesses.length < 2) return;

    try {
      await mergeBusinesses.mutateAsync({
        targetId: selectedTargetId,
        businessIds: selectedBusinesses.map(b => b.id),
      });
      // Reset state
      setSelectedBusinesses([]);
      setSelectedTargetId(null);
      setSearchQuery('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to merge businesses:', error);
    }
  };

  const handleCancel = () => {
    setSelectedBusinesses([]);
    setSelectedTargetId(null);
    setSearchQuery('');
    setShowResults(false);
    onOpenChange(false);
  };

  const availableResults = searchResults?.businesses.filter(
    b => !selectedBusinesses.find(sb => sb.id === b.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Business Merge</DialogTitle>
          <DialogDescription>
            Search and add businesses to merge, then select which one to keep
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Section */}
          <div className="space-y-2">
            <Label>Search for businesses to merge</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Type business name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(e.target.value.length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setShowResults(false);
                  }
                }}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Search Results Dropdown */}
            {showResults && availableResults.length > 0 && (
              <div className="border rounded-lg max-h-[200px] overflow-y-auto bg-white shadow-lg">
                {availableResults.slice(0, 10).map((business) => (
                  <div
                    key={business.id}
                    className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                    onClick={() => handleAddBusiness(business)}
                  >
                    <div className="font-medium">{business.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {business.normalized_name} · {business.transaction_count} transactions · ₪
                      {business.total_spent.toLocaleString('en-IL')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Businesses */}
          {selectedBusinesses.length > 0 && (
            <div className="space-y-2">
              <Label>
                Businesses to merge ({selectedBusinesses.length})
                {selectedBusinesses.length < 2 && (
                  <span className="text-muted-foreground ml-2 text-sm">
                    (Add at least 2 to merge)
                  </span>
                )}
              </Label>
              <div className="space-y-2">
                {selectedBusinesses.map((business) => (
                  <div
                    key={business.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-accent/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{business.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {business.normalized_name} · {business.transaction_count} transactions · ₪
                        {business.total_spent.toLocaleString('en-IL')}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveBusiness(business.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Selection */}
          {selectedBusinesses.length >= 2 && (
            <div className="space-y-2">
              <Label>Select which business to keep</Label>
              <RadioGroup
                value={selectedTargetId?.toString()}
                onValueChange={(value) => setSelectedTargetId(parseInt(value))}
              >
                <div className="space-y-2">
                  {selectedBusinesses.map((business) => (
                    <div
                      key={business.id}
                      className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent"
                    >
                      <RadioGroupItem
                        value={business.id.toString()}
                        id={`target-${business.id}`}
                      />
                      <Label htmlFor={`target-${business.id}`} className="flex-1 cursor-pointer">
                        <div className="font-semibold">{business.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Normalized: {business.normalized_name}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {business.transaction_count} transactions · ₪
                          {business.total_spent.toLocaleString('en-IL')}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMerge}
            disabled={selectedBusinesses.length < 2 || !selectedTargetId || mergeBusinesses.isPending}
          >
            {mergeBusinesses.isPending ? 'Merging...' : 'Merge Businesses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
