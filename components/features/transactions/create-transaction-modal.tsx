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
    label: c.last4 ? `${c.nickname || c.bankOrCompany} •••• ${c.last4}` : (c.nickname || c.bankOrCompany || 'Cash'),
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

        <form onSubmit={handleSubmit} className="space-y-6 px-1">
          {/* Business Selection */}
          <div className="space-y-2">
            <Label htmlFor="business">Business *</Label>
            <Popover open={businessOpen} onOpenChange={setBusinessOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={businessOpen}
                  className="w-full justify-between h-10"
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
          <div className="space-y-2">
            <Label>Deal Date (First Payment) *</Label>
            <DatePicker
              value={formData.dealDate}
              onChange={(date) => setFormData({ ...formData, dealDate: date })}
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
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
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger className="h-10">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="card">Card *</Label>
              {cardsLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading cards...</div>
              ) : cardsError ? (
                <div className="text-sm text-red-500 py-2">Error loading cards: {cardsError.message}</div>
              ) : !cardsData?.cards || cardsData.cards.length === 0 ? (
                <div className="text-sm text-yellow-600 py-2">No cards found. Please add a card first.</div>
              ) : (
                <Select
                  value={formData.cardId?.toString()}
                  onValueChange={(value) => setFormData({ ...formData, cardId: parseInt(value) })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select card..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cardsData?.cards?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.last4 ? (
                          `${c.nickname || c.bankOrCompany} •••• ${c.last4}`
                        ) : (
                          <span className="text-emerald-600 font-medium">{c.nickname || c.bankOrCompany || 'Cash'}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Type</Label>
              <Select
                value={formData.isRefund ? 'refund' : formData.paymentType}
                onValueChange={(value: 'one_time' | 'installments' | 'refund') => {
                  if (value === 'refund') {
                    setFormData({ ...formData, paymentType: 'one_time', isRefund: true });
                  } else {
                    setFormData({ ...formData, paymentType: value, isRefund: false });
                  }
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="installments">Installments</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Installment Fields (conditional) */}
          {formData.paymentType === 'installments' && (
            <div className="space-y-2">
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
                className="h-10"
              />
              <p className="text-sm text-muted-foreground mt-1.5">
                Amount will be divided equally across all payments
              </p>
            </div>
          )}

          {/* Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
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
                <SelectTrigger className="h-10">
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
            <div className="space-y-2">
              <Label htmlFor="childCategory">Sub Category</Label>
              <Select
                value={formData.childCategoryId?.toString() || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, childCategoryId: value ? parseInt(value) : undefined })
                }
                disabled={!formData.primaryCategoryId}
              >
                <SelectTrigger className="h-10">
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

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={createTransaction.isPending} className="w-full sm:w-auto">
              {createTransaction.isPending ? 'Creating...' : 'Create Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
