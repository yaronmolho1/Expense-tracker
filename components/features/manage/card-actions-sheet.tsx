'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MoreVertical, Edit, Trash2, FileText } from 'lucide-react';
import { Card } from '@/hooks/use-cards';

// Format issuer for display
function formatIssuer(issuer: string): string {
  switch (issuer) {
    case 'MAX':
      return 'Max';
    case 'VISA-CAL':
      return 'Visa / Cal';
    case 'ISRACARD':
      return 'Isracard / Amex';
    default:
      return issuer;
  }
}

interface CardActionsSheetProps {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (isActive: boolean) => void;
  onShowUploads: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CardActionsSheet({
  card,
  onEdit,
  onDelete,
  onToggleActive,
  onShowUploads,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: CardActionsSheetProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange || setInternalIsOpen;

  const handleEdit = () => {
    onEdit();
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setIsOpen(false);
  };

  const handleShowUploads = () => {
    onShowUploads();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>****{card.last4}</SheetTitle>
          <SheetDescription>
            {formatIssuer(card.issuer)} • {card.bankOrCompany || 'No bank specified'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 p-4">
          {/* Edit Button */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleEdit}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Card
          </Button>

          {/* Upload History Button */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleShowUploads}
          >
            <FileText className="h-4 w-4 mr-2" />
            Upload History
          </Button>

          {/* Active/Inactive Toggle */}
          <div className="flex items-center justify-between p-3 border rounded">
            <span className="text-sm font-medium">Active Status</span>
            <div className="flex items-center gap-2">
              <Label htmlFor={`sheet-active-${card.id}`} className="text-sm text-muted-foreground">
                {card.isActive ? 'Active' : 'Inactive'}
              </Label>
              <Switch
                id={`sheet-active-${card.id}`}
                checked={card.isActive}
                onCheckedChange={(checked) => {
                  onToggleActive(checked);
                }}
              />
            </div>
          </div>

          {/* Delete Button */}
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Card
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
