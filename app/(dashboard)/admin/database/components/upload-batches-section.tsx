'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { BatchDeleteConfirmDialog } from './batch-delete-confirm-dialog';

type InstallmentStrategy = 'delete_matching' | 'delete_all' | 'skip';

interface UploadBatch {
  id: number;
  uploadedAt: string;
  fileCount: number;
  totalTransactions: number;
  newTransactions: number;
  updatedTransactions: number;
  status: string;
  files: Array<{
    id: number;
    filename: string;
    cardId: number | null;
    cardLast4: string | null;
    transactionsFound: number;
    status: string;
  }>;
}

export function UploadBatchesSection() {
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [warnings, setWarnings] = useState<any | null>(null);
  const [installmentStrategy, setInstallmentStrategy] = useState<InstallmentStrategy>('delete_matching');
  const [batchIdsToDelete, setBatchIdsToDelete] = useState<number[]>([]);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; name: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [fileIdsToDelete, setFileIdsToDelete] = useState<number[]>([]);

  const queryClient = useQueryClient();

  // Fetch upload batches
  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['upload-batches'],
    queryFn: async () => {
      const response = await fetch('/api/admin/upload-batches');
      if (!response.ok) throw new Error('Failed to fetch upload batches');
      return response.json();
    },
  });

  // Filter out batches with zero transactions and filter files within batches to only show those with transactions
  const batches: UploadBatch[] = (batchesData?.batches || [])
    .map((batch: UploadBatch) => ({
      ...batch,
      files: batch.files.filter((file) => file.transactionsFound > 0),
    }))
    .filter((batch: UploadBatch) => batch.totalTransactions > 0);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ batchIds, strategy }: { batchIds: number[]; strategy?: InstallmentStrategy }) => {
      if (batchIds.length === 1) {
        // Single batch deletion
        const url = strategy
          ? `/api/batches/${batchIds[0]}/delete?installmentStrategy=${strategy}`
          : `/api/batches/${batchIds[0]}/delete`;
        const response = await fetch(url, { method: 'DELETE' });
        return response.json();
      } else {
        // Bulk deletion
        const response = await fetch('/api/admin/upload-batches/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchIds, installmentStrategy: strategy }),
        });
        return response.json();
      }
    },
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedBatches(new Set(batches.map(b => b.id)));
    } else {
      setSelectedBatches(new Set());
    }
  };

  const handleBatchSelect = (batchId: number, checked: boolean) => {
    const newSelected = new Set(selectedBatches);
    if (checked) {
      newSelected.add(batchId);
    } else {
      newSelected.delete(batchId);
      setSelectAll(false);
    }
    setSelectedBatches(newSelected);
  };

  const handleFileSelect = (fileId: number, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAllFilesInBatch = (batchId: number, checked: boolean) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;

    const newSelected = new Set(selectedFiles);
    batch.files.forEach(file => {
      if (checked) {
        newSelected.add(file.id);
      } else {
        newSelected.delete(file.id);
      }
    });
    setSelectedFiles(newSelected);
  };

  const toggleExpand = (batchId: number) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedBatches(newExpanded);
  };

  const handleDeleteClick = async (batchIds: number[]) => {
    setBatchIdsToDelete(batchIds);

    // Try to delete without strategy first to get warnings
    const result = await deleteMutation.mutateAsync({ batchIds });

    if (result.requiresConfirmation) {
      setWarnings(result);
      setDeleteConfirmOpen(true);
    } else if (result.success) {
      toast.success(`Deleted ${result.deletedBatches || 1} batch(es) and ${result.deletedTransactions} transaction(s)`);
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSelectedBatches(new Set());
      setSelectAll(false);
    } else {
      toast.error(result.error || 'Failed to delete batch(es)');
    }
  };

  const handleConfirmedDelete = async () => {
    const result = await deleteMutation.mutateAsync({
      batchIds: batchIdsToDelete,
      strategy: installmentStrategy,
    });

    if (result.success) {
      toast.success(`Deleted ${result.deletedBatches || 1} batch(es) and ${result.deletedTransactions} transaction(s)`);
      setDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['time-flow'] });
      setSelectedBatches(new Set());
      setSelectAll(false);
      setInstallmentStrategy('delete_matching');
    } else {
      toast.error(result.error || 'Failed to delete batch(es)');
    }
  };

  const handleBulkDeleteFiles = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Please select at least one file to delete');
      return;
    }

    const fileIds = Array.from(selectedFiles);
    setFileIdsToDelete(fileIds);

    try {
      const response = await fetch('/api/admin/files/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds }),
      });

      const result = await response.json();

      if (result.requiresConfirmation) {
        setWarnings(result);
        setDeleteConfirmOpen(true);
      } else if (result.success) {
        toast.success(`Deleted ${fileIds.length} file(s) and ${result.deletedTransactions} transaction(s)`);
        queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        setSelectedFiles(new Set());
      } else {
        toast.error(result.error || 'Failed to delete files');
      }
    } catch (error) {
      toast.error('Failed to delete files');
    }
  };

  const handleFileDelete = async (fileId: number, filename: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/delete`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.requiresConfirmation) {
        // Show confirmation dialog for this file
        setFileToDelete({ id: fileId, name: filename });
        setWarnings(result);
        setDeleteConfirmOpen(true);
      } else if (result.success) {
        toast.success(`Deleted ${filename} and ${result.deletedTransactions} transaction(s)`);
        queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      } else {
        toast.error(result.error || 'Failed to delete file');
      }
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  const handleConfirmedFileDelete = async () => {
    if (!fileToDelete && fileIdsToDelete.length === 0) return;

    try {
      if (fileIdsToDelete.length > 0) {
        // Bulk delete files
        const response = await fetch('/api/admin/files/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileIds: fileIdsToDelete,
            installmentStrategy
          }),
        });

        const result = await response.json();

        if (result.success) {
          toast.success(`Deleted ${fileIdsToDelete.length} file(s) and ${result.deletedTransactions} transaction(s)`);
          setDeleteConfirmOpen(false);
          setFileIdsToDelete([]);
          setSelectedFiles(new Set());
          queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['businesses'] });
          queryClient.invalidateQueries({ queryKey: ['time-flow'] });
          setInstallmentStrategy('delete_matching');
        } else {
          toast.error(result.error || 'Failed to delete files');
        }
      } else if (fileToDelete) {
        // Single file delete
        const response = await fetch(`/api/files/${fileToDelete.id}/delete?installmentStrategy=${installmentStrategy}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
          toast.success(`Deleted ${fileToDelete.name} and ${result.deletedTransactions} transaction(s)`);
          setDeleteConfirmOpen(false);
          setFileToDelete(null);
          queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['businesses'] });
          queryClient.invalidateQueries({ queryKey: ['time-flow'] });
          setInstallmentStrategy('delete_matching');
        } else {
          toast.error(result.error || 'Failed to delete file');
        }
      }
    } catch (error) {
      toast.error('Failed to delete file(s)');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>View and manage file upload batches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>View and manage file upload batches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">No upload batches found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>View and manage file upload batches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <div>{selectedBatches.size} batch(es) selected</div>
              {selectedFiles.size > 0 && (
                <div>{selectedFiles.size} file(s) selected</div>
              )}
            </div>
            <div className="flex gap-2">
              {selectedFiles.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteFiles}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedFiles.size} File(s)
                </Button>
              )}
              {selectedBatches.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(Array.from(selectedBatches))}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedBatches.size} Batch(es)
                </Button>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                    className="border-2"
                  />
                </TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map(batch => (
                <React.Fragment key={batch.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectedBatches.has(batch.id)}
                        onCheckedChange={(checked) => handleBatchSelect(batch.id, !!checked)}
                        className="border-2"
                      />
                    </TableCell>
                    <TableCell>{formatDate(batch.uploadedAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(batch.id)}
                      >
                        {batch.fileCount} file{batch.fileCount !== 1 ? 's' : ''}
                        {expandedBatches.has(batch.id) ? (
                          <ChevronUp className="h-4 w-4 ml-1" />
                        ) : (
                          <ChevronDown className="h-4 w-4 ml-1" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{batch.totalTransactions || 0}</div>
                        <div className="text-xs text-muted-foreground">
                          {batch.newTransactions || 0} new, {batch.updatedTransactions || 0} updated
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick([batch.id])}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expandable file list */}
                  {expandedBatches.has(batch.id) && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/50">
                        <div className="p-4 space-y-2">
                          {/* Select all files in batch */}
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                            <Checkbox
                              checked={batch.files.every(f => selectedFiles.has(f.id))}
                              onCheckedChange={(checked) => handleSelectAllFilesInBatch(batch.id, !!checked)}
                              className="border-2"
                            />
                            <span className="text-sm font-medium text-muted-foreground">
                              Select all files in this batch
                            </span>
                          </div>

                          {batch.files.map(file => (
                            <div key={file.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-muted/70">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={selectedFiles.has(file.id)}
                                  onCheckedChange={(checked) => handleFileSelect(file.id, !!checked)}
                                  className="border-2"
                                />
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{file.filename}</span>
                                {file.cardLast4 && (
                                  <Badge variant="outline">•••• {file.cardLast4}</Badge>
                                )}
                                <span className="text-muted-foreground text-xs">
                                  {file.transactionsFound || 0} transactions
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleFileDelete(file.id, file.filename)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {warnings && (
        <BatchDeleteConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          warnings={warnings}
          strategy={installmentStrategy}
          onStrategyChange={setInstallmentStrategy}
          onConfirm={fileToDelete || fileIdsToDelete.length > 0 ? handleConfirmedFileDelete : handleConfirmedDelete}
          title={
            fileIdsToDelete.length > 0
              ? `Delete ${fileIdsToDelete.length} file${fileIdsToDelete.length !== 1 ? 's' : ''}?`
              : fileToDelete
              ? `Delete file ${fileToDelete.name}?`
              : `Delete ${batchIdsToDelete.length} Upload Batch${batchIdsToDelete.length !== 1 ? 'es' : ''}?`
          }
          confirmButtonText={
            fileIdsToDelete.length > 0
              ? 'Delete Files'
              : fileToDelete
              ? 'Delete File'
              : 'Delete Batches'
          }
        />
      )}
    </>
  );
}
