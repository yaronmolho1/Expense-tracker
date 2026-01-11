'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Card {
  id: number;
  last4: string;
  nickname: string | null;
  bankOrCompany: string;
  issuer: string;
  fileFormatHandler: string;
}

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onCardAdded: (card: Card) => void;
  owner: string;
}

const ISSUERS = [
  { value: 'MAX', label: 'Max' },
  { value: 'VISA-CAL', label: 'Visa / Cal' },
  { value: 'ISRACARD', label: 'Isracard / Amex' },
];

export function AddCardDialog({ open, onClose, onCardAdded, owner }: AddCardDialogProps) {
  const [last4, setLast4] = useState('');
  const [issuer, setIssuer] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate
      if (!/^\d{4}$/.test(last4)) {
        throw new Error('Last 4 digits must be exactly 4 numbers');
      }

      if (!issuer) {
        throw new Error('Please select a card issuer');
      }

      // Create card
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          last4,
          issuer,
          nickname: nickname || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('This card already exists');
        }
        throw new Error(data.error || 'Failed to create card');
      }

      // Success
      onCardAdded(data.card);

      // Reset form
      setLast4('');
      setIssuer('');
      setNickname('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setLast4('');
      setIssuer('');
      setNickname('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Card</DialogTitle>
          <DialogDescription>
            Enter the last 4 digits and select the card issuer to add a new credit card.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Last 4 Digits */}
            <div className="grid gap-2">
              <Label htmlFor="last4">Last 4 Digits *</Label>
              <Input
                id="last4"
                type="text"
                placeholder="1234"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                required
                disabled={loading}
              />
            </div>

            {/* Issuer */}
            <div className="grid gap-2">
              <Label htmlFor="issuer">Card Issuer *</Label>
              <Select value={issuer} onValueChange={setIssuer} disabled={loading} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select issuer..." />
                </SelectTrigger>
                <SelectContent>
                  {ISSUERS.map((iss) => (
                    <SelectItem key={iss.value} value={iss.value}>
                      {iss.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nickname (Optional) */}
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname (Optional)</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="e.g., Personal Card, Business Card"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !last4 || !issuer}>
              {loading ? 'Adding...' : 'Add Card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
