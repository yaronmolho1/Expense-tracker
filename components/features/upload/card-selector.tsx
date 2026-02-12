'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AddCardDialog } from './add-card-dialog';

interface Card {
  id: number;
  last4: string | null;
  nickname: string | null;
  bankOrCompany: string | null;
  issuer: string | null;
  fileFormatHandler: string | null;
}

interface CardSelectorProps {
  value: number | null;
  onChange: (cardId: number) => void;
  owner: string;
}

export function CardSelector({ value, onChange, owner }: CardSelectorProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadCards = async () => {
    try {
      const response = await fetch(`/api/cards?owner=${encodeURIComponent(owner)}`);
      const data = await response.json();
      // Only show cards that have a fileFormatHandler (exclude cash and other system cards)
      setCards((data.cards || []).filter((c: Card) => c.fileFormatHandler));
      setLoading(false);
    } catch (error) {
      console.error('Failed to load cards:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [owner]);

  const handleCardAdded = (newCard: Card) => {
    setCards((prev) => [newCard, ...prev]);
    onChange(newCard.id);
    setShowAddDialog(false);
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading cards...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value?.toString()} onValueChange={(val) => onChange(parseInt(val))}>
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Select card..." />
        </SelectTrigger>
        <SelectContent>
          {cards.map((card) => (
            <SelectItem key={card.id} value={card.id.toString()}>
              {card.nickname || card.bankOrCompany}{card.last4 ? ` (•••• ${card.last4})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={() => setShowAddDialog(true)} title="Add new card">
        <Plus className="h-4 w-4" />
      </Button>

      <AddCardDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCardAdded={handleCardAdded}
        owner={owner}
      />
    </div>
  );
}
