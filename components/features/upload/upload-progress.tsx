'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface UploadProgressProps {
  batchId: number;
  onReset: () => void;
}

interface BatchStatus {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_percent: number;
  file_count: number;
  files: {
    id: number;
    filename: string;
    status: string;
    transactions_found: number | null;
    error_message: string | null;
    validation_warning: string | null;
  }[];
  summary: {
    total_transactions: number | null;
    new_transactions: number | null;
    updated_transactions: number | null;
  };
  error_message: string | null;
}

export function UploadProgress({ batchId, onReset }: UploadProgressProps) {
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/upload/${batchId}`);
        const data = await response.json();
        setStatus(data);

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    poll(); // Initial fetch

    if (polling) {
      const interval = setInterval(poll, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [batchId, polling]);

  if (!status) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const isComplete = status.status === 'completed';
  const isFailed = status.status === 'failed';
  
  // Check if there's a warning message (duplicates, etc.)
  const hasWarnings = isComplete && status.error_message !== null;

  // Check if processing completed but no transactions were created
  const hasNoTransactions = isComplete && (status.summary.total_transactions === 0 || status.summary.total_transactions === null);
  const showAsWarning = hasNoTransactions || hasWarnings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {showAsWarning && 'Upload Completed with Issues'}
          {isComplete && !showAsWarning && 'Upload Complete!'}
          {isFailed && 'Upload Failed'}
          {!isComplete && !isFailed && 'Processing Files...'}
        </h2>
        {isComplete && !showAsWarning && <CheckCircle2 className="h-8 w-8 text-green-500" />}
        {showAsWarning && <AlertTriangle className="h-8 w-8 text-amber-500" />}
        {isFailed && <XCircle className="h-8 w-8 text-red-500" />}
      </div>

      {/* Progress bar */}
      {!isComplete && !isFailed && (
        <div className="space-y-2">
          <Progress value={status.progress_percent} className="h-2" />
          <p className="text-sm text-gray-600 text-center">
            {status.progress_percent}% complete
          </p>
        </div>
      )}

      {/* Summary */}
      {isComplete && status.summary.total_transactions !== null && (
        <div className="grid grid-cols-3 gap-4 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-700">
              {status.summary.total_transactions}
            </p>
            <p className="text-sm text-green-600">Total Transactions</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-700">
              {status.summary.new_transactions}
            </p>
            <p className="text-sm text-blue-600">New</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-700">
              {status.summary.updated_transactions}
            </p>
            <p className="text-sm text-gray-600">Updated</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {isFailed && status.error_message && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {status.error_message}
        </div>
      )}

      {/* Warning message for duplicates or issues */}
      {hasWarnings && status.error_message && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Processing Notice</h3>
              <p className="text-sm text-amber-800 mt-1">
                {status.error_message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning for no transactions */}
      {showAsWarning && !status.error_message && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">No Transactions Processed</h3>
              <p className="text-sm text-amber-800 mt-1">
                The upload completed but no transactions were extracted. This usually means:
              </p>
              <ul className="text-sm text-amber-800 mt-2 ml-4 list-disc space-y-1">
                <li>No card was assigned to the file (check file status below)</li>
                <li>The file format was not recognized by the parser</li>
                <li>The file had no valid transactions to import</li>
              </ul>
              <p className="text-sm text-amber-800 mt-2">
                Please check the file details below for more information.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="space-y-3">
        <h3 className="font-semibold">Files ({status.file_count})</h3>
        {status.files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex-1">
              <p className="font-medium">{file.filename}</p>
              {file.transactions_found !== null && (
                <p className="text-sm text-gray-600">
                  {file.transactions_found} transactions found
                </p>
              )}
              {file.error_message && (
                <p className="text-sm text-red-600">{file.error_message}</p>
              )}
              {file.validation_warning && (
                <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">{file.validation_warning}</p>
                </div>
              )}
            </div>
            <div>
              {file.status === 'completed' && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {file.status === 'failed' && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {file.status === 'processing' && (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              )}
              {file.status === 'pending' && (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {(isComplete || isFailed) && (
        <div className="flex gap-3">
          <Button
            onClick={async () => {
              setIsDeleting(true);
              try {
                const response = await fetch(`/api/batches/${batchId}/delete`, {
                  method: 'DELETE',
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log(`Deleted batch ${batchId}: ${result.deletedTransactions} transactions, ${result.deletedFiles} files`);
                  onReset();
                } else {
                  console.error('Failed to delete batch');
                  alert('Failed to delete batch');
                }
              } catch (error) {
                console.error('Delete error:', error);
                alert('Failed to delete batch');
              } finally {
                setIsDeleting(false);
              }
            }}
            variant="destructive"
            disabled={isDeleting}
            className="flex-1"
            size="lg"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Upload
              </>
            )}
          </Button>
          <Button onClick={onReset} className="flex-1" size="lg">
            Upload More Files
          </Button>
        </div>
      )}
    </div>
  );
}
