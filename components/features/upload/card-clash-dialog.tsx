'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { CardDetectionResult } from '@/lib/services/card-detection.service';

interface CardClashDialogProps {
  open: boolean;
  onClose: () => void;
  detectionResult: CardDetectionResult;
  filename: string;
  onResolve: (resolvedCardId: number | null) => void;
}

export function CardClashDialog({
  open,
  onClose,
  detectionResult,
  filename,
  onResolve,
}: CardClashDialogProps) {
  const { status, clashDetails, message } = detectionResult;

  const handleUseUserProvided = () => {
    // User selected card takes precedence
    if (clashDetails?.userProvided) {
      // Create new card or use existing based on detection
      onResolve(null); // Will need to create card
    }
  };

  const handleUseDatabase = () => {
    if (clashDetails?.dbCard) {
      onResolve(clashDetails.dbCard.id);
    }
  };

  const handleUseFilename = () => {
    // Use filename detection
    onResolve(null); // Will need to create card
  };

  const handleUseHeader = () => {
    // Use header detection
    onResolve(null); // Will need to create card
  };

  const handleManual = () => {
    // User will manually select/add card
    onResolve(null);
    onClose();
  };

  if (status !== 'CLASH') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Card Information Conflict</DialogTitle>
          </div>
          <DialogDescription>
            We detected conflicting card information for file: <strong>{filename}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Main message */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            {message}
          </div>

          {/* Clash details */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Detected Information:</h4>

            {/* User provided */}
            {clashDetails?.userProvided && (
              <div className="p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Your Selection</p>
                    <p className="text-sm text-gray-600">
                      {clashDetails.userProvided.issuer} •••• {clashDetails.userProvided.last4}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleUseUserProvided}>
                    Use This
                  </Button>
                </div>
              </div>
            )}

            {/* Filename */}
            {clashDetails?.filename && (
              <div className="p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">From Filename</p>
                    <p className="text-sm text-gray-600">
                      {clashDetails.filename.issuer} •••• {clashDetails.filename.last4}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleUseFilename}>
                    Use This
                  </Button>
                </div>
              </div>
            )}

            {/* Header */}
            {clashDetails?.header && (
              <div className="p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">From File Header</p>
                    <p className="text-sm text-gray-600">
                      {clashDetails.header.issuer} •••• {clashDetails.header.last4}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleUseHeader}>
                    Use This
                  </Button>
                </div>
              </div>
            )}

            {/* Database card */}
            {clashDetails?.dbCard && (
              <div className="p-3 border rounded-md bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      Existing Card in Database {clashDetails.dbCard.nickname ? `(${clashDetails.dbCard.nickname})` : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      {clashDetails.dbCard.issuer} •••• {clashDetails.dbCard.last4}
                    </p>
                  </div>
                  <Button variant="default" size="sm" onClick={handleUseDatabase}>
                    Use This
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleManual}>
            Select Manually
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
