'use client';

import { useState } from 'react';
import { useMergeSuggestions, useApproveMerge, useRejectMerge } from '@/hooks/use-merge-suggestions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertCircle, GitMerge, X } from 'lucide-react';

interface MergeSuggestion {
  id: number;
  business_1: {
    id: number;
    name: string;
    normalized_name: string;
    primary_category_id: number | null;
    child_category_id: number | null;
  };
  business_2: {
    id: number;
    name: string;
    normalized_name: string;
    primary_category_id: number | null;
    child_category_id: number | null;
  };
  similarity_score: string;
  reason: string | null;
  created_at: Date;
}

export function MergeSuggestionsTable() {
  const { data, isLoading } = useMergeSuggestions();
  const approveMerge = useApproveMerge();
  const rejectMerge = useRejectMerge();

  const [previewSuggestion, setPreviewSuggestion] = useState<MergeSuggestion | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  const handleApprove = (suggestion: MergeSuggestion) => {
    setPreviewSuggestion(suggestion);
    setSelectedBusinessId(null); // Reset selection
  };

  const confirmMerge = async () => {
    if (!previewSuggestion || !selectedBusinessId) return;

    try {
      await approveMerge.mutateAsync({
        suggestionId: previewSuggestion.id,
        targetId: selectedBusinessId,
      });
      setPreviewSuggestion(null);
      setSelectedBusinessId(null);
    } catch (error) {
      console.error('Failed to approve merge:', error);
    }
  };

  const handleReject = async (suggestionId: number) => {
    try {
      await rejectMerge.mutateAsync(suggestionId);
    } catch (error) {
      console.error('Failed to reject merge:', error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading suggestions...</div>;
  }

  if (!data || data.suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No merge suggestions found.</p>
        <p className="text-sm mt-1">The system will detect duplicates automatically.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business 1</TableHead>
            <TableHead>Business 2</TableHead>
            <TableHead>Similarity</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.suggestions.map((suggestion) => (
            <TableRow key={suggestion.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{suggestion.business_1.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {suggestion.business_1.normalized_name}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{suggestion.business_2.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {suggestion.business_2.normalized_name}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {(parseFloat(suggestion.similarity_score) * 100).toFixed(0)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApprove(suggestion)}
                  disabled={approveMerge.isPending}
                >
                  <GitMerge className="h-4 w-4 mr-1" />
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleReject(suggestion.id)}
                  disabled={rejectMerge.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Preview Modal */}
      <Dialog open={!!previewSuggestion} onOpenChange={() => setPreviewSuggestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Merge Businesses</DialogTitle>
            <DialogDescription>
              Select which business to keep. All transactions from the other business will be moved.
            </DialogDescription>
          </DialogHeader>

          {previewSuggestion && (
            <RadioGroup
              value={selectedBusinessId?.toString()}
              onValueChange={(value) => setSelectedBusinessId(parseInt(value))}
            >
              <div className="space-y-4">
                {/* Business 1 Option */}
                <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent">
                  <RadioGroupItem
                    value={previewSuggestion.business_1.id.toString()}
                    id="business-1"
                  />
                  <Label htmlFor="business-1" className="flex-1 cursor-pointer">
                    <div className="font-semibold">{previewSuggestion.business_1.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Normalized: {previewSuggestion.business_1.normalized_name}
                    </div>
                  </Label>
                </div>

                {/* Business 2 Option */}
                <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent">
                  <RadioGroupItem
                    value={previewSuggestion.business_2.id.toString()}
                    id="business-2"
                  />
                  <Label htmlFor="business-2" className="flex-1 cursor-pointer">
                    <div className="font-semibold">{previewSuggestion.business_2.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Normalized: {previewSuggestion.business_2.normalized_name}
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewSuggestion(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmMerge}
              disabled={!selectedBusinessId || approveMerge.isPending}
            >
              {approveMerge.isPending ? 'Merging...' : 'Confirm Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
