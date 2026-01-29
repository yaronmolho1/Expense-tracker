'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Transaction, useUpdateTransactionStatus } from '@/hooks/use-transactions';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface MobileStatusEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const statusConfig = {
  completed: {
    label: 'Completed',
    variant: 'default' as const,
  },
  projected: {
    label: 'Projected',
    variant: 'secondary' as const,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'outline' as const,
  },
};

export function MobileStatusEditorDialog({
  isOpen,
  onClose,
  transaction,
}: MobileStatusEditorDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<'completed' | 'projected' | 'cancelled'>(
    transaction?.status || 'completed'
  );
  const updateStatus = useUpdateTransactionStatus();

  // Update selectedStatus when transaction changes
  const handleOpenChange = (open: boolean) => {
    if (open && transaction) {
      setSelectedStatus(transaction.status);
    } else if (!open) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!transaction) return;

    if (selectedStatus === transaction.status) {
      toast.info('Status unchanged');
      onClose();
      return;
    }

    try {
      await updateStatus.mutateAsync({
        transactionId: transaction.id,
        status: selectedStatus,
      });
      toast.success('Status updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] sm:w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Info */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Transaction
            </div>
            <div className="text-base font-semibold">{transaction.business_name}</div>
            <div className="text-sm text-muted-foreground">
              {new Intl.NumberFormat('en-IL', {
                style: 'currency',
                currency: 'ILS',
              }).format(transaction.charged_amount_ils)}
            </div>
          </div>

          {/* Current Status */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Current Status
            </div>
            <Badge variant={statusConfig[transaction.status].variant}>
              {statusConfig[transaction.status].label}
            </Badge>
          </div>

          {/* Status Select */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              New Status
            </div>
            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Completed</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="projected">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Projected</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="cancelled">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Cancelled</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onClose()} className="flex-1" disabled={updateStatus.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={updateStatus.isPending}>
            {updateStatus.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
