'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { useCreateTransaction, type CreateTransactionPayload } from '@/hooks/use-transactions';
import { useBusinesses } from '@/hooks/use-businesses';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTransactionModal({ isOpen, onClose }: CreateTransactionModalProps) {
  const createTransaction = useCreateTransaction();
  const { data: businessesData } = useBusinesses({ search: '', sort: 'name' }, { enabled: isOpen });

  // Fetch cards
  const { data: cardsData, isLoading: cardsLoading, error: cardsError } = useQuery({
    queryKey: ['cards', 'default-user'],
    queryFn: async () => {
      const response = await fetch('/api/cards?owner=default-user');
      if (!response.ok) throw new Error('Failed to fetch cards');
      return response.json();
    },
    staleTime: 30000,
    enabled: isOpen,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      return data.categories;
    },
    staleTime: 60000,
    enabled: isOpen,
  });

  const [formData, setFormData] = useState<CreateTransactionPayload>({
    cardId: 0,
    dealDate: new Date().toISOString().split('T')[0],
    amount: 0,
    currency: 'ILS',
    paymentType: 'one_time',
  });

  const [businessSearch, setBusinessSearch] = useState('');
  const [businessOpen, setBusinessOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        cardId: 0,
        dealDate: new Date().toISOString().split('T')[0],
        amount: 0,
        currency: 'ILS',
        paymentType: 'one_time',
      });
      setBusinessSearch('');
      setBusinessOpen(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cardId || formData.amount === 0) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.businessId && !businessSearch.trim()) {
      alert('Please select or create a business');
      return;
    }

    try {
      const payload: CreateTransactionPayload = {
        ...formData,
        businessId: formData.businessId,
        businessName: !formData.businessId ? businessSearch.trim() : undefined,
      };

      await createTransaction.mutateAsync(payload);
      onClose();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction');
    }
  };

  // Filter businesses based on search
  const filteredBusinesses = businessesData?.businesses.filter((business) =>
    business.display_name.toLowerCase().includes(businessSearch.toLowerCase())
  );

  // Get selected business name for display
  const selectedBusiness = businessesData?.businesses.find((b) => b.id === formData.businessId);
  const businessDisplayValue = selectedBusiness?.display_name || businessSearch;

  const businessOptions = businessesData?.businesses.map((b) => ({
    value: b.id.toString(),
    label: b.display_name,
  })) || [];

  const cardOptions = cardsData?.cards?.map((c: any) => ({
    value: c.id.toString(),
    label: `${c.nickname || c.bankOrCompany} •••• ${c.last4}`,
  })) || [];

  const parentCategoryOptions = categoriesData?.map((c: any) => ({
    value: c.id.toString(),
    label: c.name,
  })) || [];

  const selectedParentCategory = categoriesData?.find((c: any) => c.id === formData.primaryCategoryId);
  const childCategoryOptions = selectedParentCategory?.children?.map((c: any) => ({
    value: c.id.toString(),
    label: c.name,
  })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
          <DialogDescription>
            Manually add a transaction to your records
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Selection */}
          <div>
            <Label htmlFor="business">Business *</Label>
            <Popover open={businessOpen} onOpenChange={setBusinessOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={businessOpen}
                  className="w-full justify-between"
                >
                  {businessDisplayValue || 'Select business...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search or type new business..."
                    value={businessSearch}
                    onValueChange={setBusinessSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="py-2 px-2 text-sm">
                        {businessSearch ? (
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              setFormData({ ...formData, businessId: undefined });
                              setBusinessOpen(false);
                            }}
                          >
                            Create &quot;{businessSearch}&quot;
                          </Button>
                        ) : (
                          'No business found. Type to create new.'
                        )}
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredBusinesses?.map((business) => (
                        <CommandItem
                          key={business.id}
                          value={business.display_name}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              businessId: business.id,
                              primaryCategoryId: business.primary_category?.id || undefined,
                              childCategoryId: business.child_category?.id || undefined,
                            });
                            setBusinessSearch(business.display_name);
                            setBusinessOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              formData.businessId === business.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {business.display_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Deal Date */}
          <div>
            <Label>Deal Date (First Payment) *</Label>
            <DatePicker
              value={formData.dealDate}
              onChange={(date) => setFormData({ ...formData, dealDate: date })}
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">
                {formData.paymentType === 'installments' ? 'Total Deal Amount *' : 'Amount *'}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">ILS (₪)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Card & Payment Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="card">Card *</Label>
              {cardsLoading ? (
                <div className="text-sm text-muted-foreground">Loading cards...</div>
              ) : cardsError ? (
                <div className="text-sm text-red-500">Error loading cards: {cardsError.message}</div>
              ) : !cardsData?.cards || cardsData.cards.length === 0 ? (
                <div className="text-sm text-yellow-600">No cards found. Please add a card first.</div>
              ) : (
                <Select
                  value={formData.cardId?.toString()}
                  onValueChange={(value) => setFormData({ ...formData, cardId: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select card..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cardOptions.map((card: { value: string; label: string }) => (
                      <SelectItem key={card.value} value={card.value}>
                        {card.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="paymentType">Payment Type</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value: 'one_time' | 'installments') =>
                  setFormData({ ...formData, paymentType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="installments">Installments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Installment Fields (conditional) */}
          {formData.paymentType === 'installments' && (
            <div>
              <Label htmlFor="installmentTotal">Number of Payments *</Label>
              <Input
                id="installmentTotal"
                type="number"
                min="1"
                value={formData.installmentTotal || ''}
                onChange={(e) =>
                  setFormData({ ...formData, installmentTotal: parseInt(e.target.value) || 1 })
                }
                placeholder="e.g., 10 payments"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Amount will be divided equally across all payments
              </p>
            </div>
          )}

          {/* Category Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primaryCategory">Main Category</Label>
              <Select
                value={formData.primaryCategoryId?.toString() || ''}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    primaryCategoryId: value ? parseInt(value) : undefined,
                    childCategoryId: undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {parentCategoryOptions.map((cat: { value: string; label: string }) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="childCategory">Sub Category</Label>
              <Select
                value={formData.childCategoryId?.toString() || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, childCategoryId: value ? parseInt(value) : undefined })
                }
                disabled={!formData.primaryCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.primaryCategoryId ? "Optional" : "Select main first"} />
                </SelectTrigger>
                <SelectContent>
                  {childCategoryOptions.map((cat: { value: string; label: string }) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? 'Creating...' : 'Create Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
