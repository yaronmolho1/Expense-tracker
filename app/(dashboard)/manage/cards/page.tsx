'use client';

import { useState } from 'react';
import { useCards, useCreateCard, useUpdateCard, useDeleteCard, Card, CreateCardInput } from '@/hooks/use-cards';
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Edit, Trash2, Plus, CreditCard, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { CardUploadsSection } from './components/card-uploads-section';
import { PageHeader } from '@/components/ui/page-header';
import { CardActionsSheet } from '@/components/features/manage/card-actions-sheet';

// Note: OWNER will come from JWT token via API (cards are user-specific)
const OWNER = 'default-user'; // Backward compatibility - API handles auth

// Format issuer for display
function formatIssuer(issuer: string | null): string {
  switch (issuer) {
    case 'MAX':
      return 'Max';
    case 'VISA-CAL':
      return 'Visa / Cal';
    case 'ISRACARD':
      return 'Isracard / Amex';
    default:
      return issuer || 'Cash';
  }
}

export default function CardsPage() {
  const { data: cards, isLoading } = useCards(OWNER);

  if (isLoading) {
    return <div className="p-8">Loading cards...</div>;
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 sm:px-6">
      <PageHeader
        title="Cards"
        description="Manage your credit and debit cards"
        actions={<CreateCardDialog />}
      />

      <div className="grid gap-3 sm:gap-4">
        {cards && cards.length > 0 ? (
          cards.filter((card) => card.last4).map((card) => <CardRow key={card.id} card={card} />)
        ) : (
          <UICard>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">No cards found. Add your first card to get started.</p>
            </CardContent>
          </UICard>
        )}
      </div>
    </div>
  );
}

// ============================================
// CARD ROW
// ============================================

function CardRow({ card }: { card: Card }) {
  const [showUploads, setShowUploads] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const updateMutation = useUpdateCard();

  const handleToggleActive = (isActive: boolean) => {
    updateMutation.mutate({
      cardId: card.id,
      input: {
        owner: OWNER,
        isActive,
      },
    }, {
      onSuccess: () => {
        toast.success(isActive ? 'Card activated' : 'Card deactivated');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <>
      <UICard className={!card.isActive ? 'opacity-60' : ''}>
        <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {card.last4 ? (
                  <span className="font-medium">****{card.last4}</span>
                ) : (
                  <span className="font-medium text-emerald-600">{card.nickname || 'Cash'}</span>
                )}
                {card.last4 && card.nickname && (
                  <span className="text-gray-500 truncate">({card.nickname})</span>
                )}
                {card.last4 ? (
                  <Badge variant="outline" className="flex-shrink-0">{formatIssuer(card.issuer)}</Badge>
                ) : (
                  <Badge variant="outline" className="flex-shrink-0 text-emerald-600 border-emerald-300">Cash</Badge>
                )}
                {!card.isActive && (
                  <Badge variant="secondary" className="flex-shrink-0">Inactive</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1 truncate">
                {card.bankOrCompany || 'No bank specified'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Desktop: Show inline controls */}
            {!card.isSystem && (
              <div className="hidden md:flex items-center gap-2">
                <Label htmlFor={`active-${card.id}`} className="text-sm text-gray-600">
                  {card.isActive ? 'Active' : 'Inactive'}
                </Label>
                <Switch
                  id={`active-${card.id}`}
                  checked={card.isActive}
                  onCheckedChange={handleToggleActive}
                />
              </div>
            )}
            {!card.isSystem && (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowEditDialog(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Mobile: Show sheet trigger */}
            <CardActionsSheet
              card={card}
              onEdit={() => setShowEditDialog(true)}
              onDelete={() => setShowDeleteDialog(true)}
              onToggleActive={handleToggleActive}
              onShowUploads={() => setShowUploads(!showUploads)}
            />
          </div>
        </div>

        {/* Upload History Section */}
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowUploads(!showUploads)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Upload History
            {showUploads ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>

          {showUploads && <CardUploadsSection cardId={card.id} />}
        </div>
      </CardContent>
    </UICard>

      {/* Dialogs (rendered outside card to work with sheet triggers) */}
      {!card.isSystem && (
        <>
          <EditCardDialog card={card} open={showEditDialog} onOpenChange={setShowEditDialog} />
          <DeleteCardButton cardId={card.id} cardName={card.last4 ? `****${card.last4}` : 'Cash'} open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
        </>
      )}
    </>
  );
}

// ============================================
// CREATE CARD DIALOG
// ============================================

function CreateCardDialog() {
  const [open, setOpen] = useState(false);
  const [last4, setLast4] = useState('');
  const [issuer, setIssuer] = useState<'MAX' | 'VISA-CAL' | 'ISRACARD'>('MAX');
  const [nickname, setNickname] = useState('');
  const [bankOrCompany, setBankOrCompany] = useState('');

  const createMutation = useCreateCard();

  const handleSubmit = async () => {
    if (!last4 || last4.length !== 4 || !/^\d{4}$/.test(last4)) {
      toast.error('Last 4 digits must be exactly 4 numbers');
      return;
    }

    createMutation.mutate({
      owner: OWNER,
      last4,
      issuer,
      nickname: nickname || undefined,
      bankOrCompany: bankOrCompany || undefined,
    }, {
      onSuccess: () => {
        toast.success('Card created successfully');
        setOpen(false);
        setLast4('');
        setIssuer('MAX');
        setNickname('');
        setBankOrCompany('');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Card</DialogTitle>
          <DialogDescription>
            Add a credit or debit card to track transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="last4">Last 4 Digits *</Label>
            <Input
              id="last4"
              placeholder="1234"
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              maxLength={4}
            />
          </div>

          <div>
            <Label htmlFor="issuer">Card Issuer *</Label>
            <Select value={issuer} onValueChange={(v) => setIssuer(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAX">Max</SelectItem>
                <SelectItem value="VISA-CAL">Visa / Cal</SelectItem>
                <SelectItem value="ISRACARD">Isracard / Amex</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nickname">Nickname (Optional)</Label>
            <Input
              id="nickname"
              placeholder="Personal Card"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="bank">Bank/Company (Optional)</Label>
            <Input
              id="bank"
              placeholder="Will auto-fill based on issuer"
              value={bankOrCompany}
              onChange={(e) => setBankOrCompany(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EDIT CARD DIALOG
// ============================================

function EditCardDialog({ card, open: controlledOpen, onOpenChange: controlledOnOpenChange }: { card: Card; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [nickname, setNickname] = useState(card.nickname || '');
  const [bankOrCompany, setBankOrCompany] = useState(card.bankOrCompany || '');

  const updateMutation = useUpdateCard();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Reset to current values when opening
      setNickname(card.nickname || '');
      setBankOrCompany(card.bankOrCompany || '');
    }
  };

  const handleSubmit = async () => {
    updateMutation.mutate({
      cardId: card.id,
      input: {
        owner: OWNER,
        nickname: nickname.trim() || null,
        bankOrCompany: bankOrCompany.trim() || null,
      },
    }, {
      onSuccess: () => {
        toast.success('Card updated successfully');
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!controlledOnOpenChange && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Card ****{card.last4}</DialogTitle>
          <DialogDescription>
            Update card nickname and bank/company name
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-nickname">Nickname</Label>
            <Input
              id="edit-nickname"
              placeholder="Personal Card"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="edit-bank">Bank/Company</Label>
            <Input
              id="edit-bank"
              placeholder="Bank name"
              value={bankOrCompany}
              onChange={(e) => setBankOrCompany(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DELETE CARD BUTTON
// ============================================

function DeleteCardButton({ cardId, cardName, open: controlledOpen, onOpenChange: controlledOnOpenChange }: { cardId: number; cardName: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const deleteMutation = useDeleteCard();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleInitialDelete = async () => {
    deleteMutation.mutate(
      { cardId, owner: OWNER, cascade: false },
      {
        onSuccess: (data) => {
          if (data.requiresConfirmation && data.transactionCount !== undefined) {
            setTransactionCount(data.transactionCount);
          } else {
            toast.success('Card deleted successfully');
            setOpen(false);
            setTransactionCount(null);
          }
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleCascadeDelete = () => {
    deleteMutation.mutate(
      { cardId, owner: OWNER, cascade: true },
      {
        onSuccess: () => {
          toast.success(`Card and ${transactionCount} transaction(s) deleted successfully`);
          setOpen(false);
          setTransactionCount(null);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTransactionCount(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!controlledOnOpenChange && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Card</DialogTitle>
          <DialogDescription>
            {transactionCount === null ? (
              <>
                Are you sure you want to permanently delete {cardName}? This action cannot be undone.
              </>
            ) : (
              <>
                <span className="font-semibold text-red-600">
                  This card has {transactionCount} transaction(s).
                </span>
                <br />
                Deleting this card will permanently remove all {transactionCount} transaction(s) associated with it.
                This action cannot be undone. Do you want to proceed?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          {transactionCount === null ? (
            <Button variant="destructive" onClick={handleInitialDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Checking...' : 'Delete Card'}
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleCascadeDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : `Delete Card & ${transactionCount} Transactions`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
