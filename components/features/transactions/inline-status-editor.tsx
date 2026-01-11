'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUpdateTransactionStatus } from '@/hooks/use-transactions';
import { toast } from 'sonner';

interface InlineStatusEditorProps {
  transactionId: number;
  currentStatus: 'completed' | 'projected' | 'cancelled';
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

export function InlineStatusEditor({
  transactionId,
  currentStatus,
}: InlineStatusEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateStatus = useUpdateTransactionStatus();

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) {
      setIsEditing(false);
      return;
    }

    try {
      await updateStatus.mutateAsync({
        transactionId,
        status: newStatus as 'completed' | 'projected' | 'cancelled',
      });
      toast.success('Status updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  if (!isEditing) {
    return (
      <Badge
        variant={statusConfig[currentStatus].variant}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        {statusConfig[currentStatus].label}
      </Badge>
    );
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      open={isEditing}
      onOpenChange={(open) => {
        if (!open) setIsEditing(false);
      }}
    >
      <SelectTrigger className="w-[130px] h-8" onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="completed">
          <Badge variant="default">Completed</Badge>
        </SelectItem>
        <SelectItem value="projected">
          <Badge variant="secondary">Projected</Badge>
        </SelectItem>
        <SelectItem value="cancelled">
          <Badge variant="outline">Cancelled</Badge>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
