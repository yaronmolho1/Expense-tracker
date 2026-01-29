'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Business {
  id: number;
  display_name: string;
  normalized_name: string;
}

interface MobileBusinessNameEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business | null;
}

export function MobileBusinessNameEditorDialog({
  isOpen,
  onClose,
  business,
}: MobileBusinessNameEditorDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Pre-fill display name when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && business) {
      setDisplayName(business.display_name);
    } else if (!open) {
      setDisplayName('');
      onClose();
    }
  };

  const handleSave = async () => {
    if (!business) return;

    // Validate non-empty name
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast.error('Display name cannot be empty');
      return;
    }

    if (trimmedName === business.display_name) {
      toast.info('Display name unchanged');
      onClose();
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: trimmedName,
        }),
      });

      if (!response.ok) throw new Error('Failed to update display name');

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });

      toast.success('Display name updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to update display name:', error);
      toast.error('Failed to update display name');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!business) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] sm:w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Business Name</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Normalized Name (Read-only) */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Normalized Name
            </div>
            <div className="text-sm text-muted-foreground">{business.normalized_name}</div>
          </div>

          {/* Display Name Input */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Display Name
            </div>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter display name"
              className="w-full"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onClose()}
            className="flex-1"
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={isUpdating || !displayName.trim()}>
            {isUpdating ? (
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
