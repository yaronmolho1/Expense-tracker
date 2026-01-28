'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CardUpload {
  batchId: number;
  batchUploadedAt: string | null;
  fileId: number;
  filename: string;
  status: string;
  transactionsFound: number;
}

interface CardUploadsSectionProps {
  cardId: number;
}

export function CardUploadsSection({ cardId }: CardUploadsSectionProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  // Fetch uploads for this card
  const { data: uploadsData, isLoading, error } = useQuery({
    queryKey: ['card-uploads', cardId],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${cardId}/uploads`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch uploads:', errorText);
        throw new Error('Failed to fetch card uploads');
      }
      const data = await response.json();
      console.log('Uploads data for card', cardId, ':', data);
      return data;
    },
  });

  // Filter out uploads with zero transactions
  const uploads: CardUpload[] = (uploadsData?.uploads || []).filter(
    (upload: CardUpload) => upload.transactionsFound > 0
  );

  if (error) {
    console.error('Upload query error:', error);
  }

  const handleFileSelect = (fileId: number, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleDeleteSingle = async (fileId: number) => {
    try {
      const response = await fetch(`/api/files/${fileId}/delete`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Deleted file and ${result.deletedTransactions || 0} transaction(s)`);
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['card-uploads', cardId] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
      } else {
        toast.error(result.error || 'Failed to delete file');
      }
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    try {
      const fileIds = Array.from(selectedFiles);
      let totalDeleted = 0;

      // Delete each file individually
      for (const fileId of fileIds) {
        const response = await fetch(`/api/files/${fileId}/delete`, {
          method: 'DELETE',
        });

        const result = await response.json();
        if (result.success) {
          totalDeleted += result.deletedTransactions || 0;
        }
      }

      toast.success(`Deleted ${fileIds.length} file(s) and ${totalDeleted} transaction(s)`);
      setSelectedFiles(new Set());

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['card-uploads', cardId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
    } catch (error) {
      toast.error('Failed to delete uploads');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading uploads...
      </div>
    );
  }

  if (!uploads.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No uploads found for this card
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {selectedFiles.size > 0 && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete {selectedFiles.size} file(s)
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {uploads.map(upload => (
          <div
            key={upload.fileId}
            className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg hover:bg-muted/50 min-w-0"
          >
            <Checkbox
              checked={selectedFiles.has(upload.fileId)}
              onCheckedChange={(checked) => handleFileSelect(upload.fileId, !!checked)}
              className="border-2 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{upload.filename}</div>
              <div className="text-xs text-muted-foreground truncate">
                {formatDate(upload.batchUploadedAt)} • {upload.transactionsFound || 0} transactions
              </div>
            </div>
            <Badge variant={upload.status === 'completed' ? 'default' : 'secondary'} className="flex-shrink-0 hidden sm:inline-flex">
              {upload.status}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteSingle(upload.fileId)}
              className="h-8 w-8 flex-shrink-0"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
