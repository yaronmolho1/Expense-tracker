'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubscriptionBackfillSelector } from './subscription-backfill-selector';

// Types
interface Business {
  id: number;
  display_name: string;
  normalized_name: string;
  primary_category?: { id: number; name: string } | null;
  child_category?: { id: number; name: string } | null;
}

interface Card {
  id: number;
  last4: string;
  nickname: string | null;
  bankOrCompany: string | null;
}

interface CategoryTree {
  id: number;
  name: string;
  children: Array<{
    id: number;
    name: string;
    parentId: number;
  }>;
}

export interface SubscriptionFormData {
  name: string; // Optional custom name for the subscription
  businessId: number | null;
  businessName: string; // For creating new business
  cardId: number | null;
  amount: number | null;
  currency: 'ILS' | 'USD' | 'EUR';
  frequency: 'monthly' | 'annual';
  startDate: string;
  endDate: string | null;
  noEndDate: boolean;
  primaryCategoryId: number | null;
  childCategoryId: number | null;
  notes: string;
  backfillTransactionIds?: number[]; // IDs of past transactions to link
  initialBackfillIds?: number[]; // Pre-selected transaction IDs (for suggestions)
}

interface AddSubscriptionFormProps {
  onSubmit: (data: SubscriptionFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  initialData?: Partial<SubscriptionFormData>;
}

export function AddSubscriptionForm({ onSubmit, onCancel, isSubmitting, initialData }: AddSubscriptionFormProps) {
  // Form state
  const [businessSearch, setBusinessSearch] = useState(initialData?.businessName || '');
  const [businessOpen, setBusinessOpen] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>(initialData?.initialBackfillIds || []);
  const [formData, setFormData] = useState<SubscriptionFormData>({
    name: initialData?.name || '',
    businessId: initialData?.businessId || null,
    businessName: initialData?.businessName || '',
    cardId: initialData?.cardId || null,
    amount: initialData?.amount || null,
    currency: initialData?.currency || 'ILS',
    frequency: initialData?.frequency || 'monthly',
    startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate || null,
    noEndDate: initialData?.noEndDate ?? true,
    primaryCategoryId: initialData?.primaryCategoryId || null,
    childCategoryId: initialData?.childCategoryId || null,
    notes: initialData?.notes || '',
  });

  // Fetch businesses
  const { data: businessesData } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const response = await fetch('/api/businesses');
      if (!response.ok) throw new Error('Failed to fetch businesses');
      const data = await response.json();
      return data.businesses as Business[];
    },
  });

  // Fetch cards
  const { data: cardsData, isLoading: cardsLoading, error: cardsError } = useQuery({
    queryKey: ['cards'],
    queryFn: async () => {
      const response = await fetch('/api/cards');
      if (!response.ok) throw new Error('Failed to fetch cards');
      const data = await response.json();
      return data.cards as Card[];
    },
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      return data.categories as CategoryTree[];
    },
  });

  // Filter businesses based on search
  const filteredBusinesses = businessesData?.filter((business) =>
    business.display_name.toLowerCase().includes(businessSearch.toLowerCase())
  );

  // Get selected business name for display
  const selectedBusiness = businessesData?.find((b) => b.id === formData.businessId);
  const businessDisplayValue = selectedBusiness?.display_name || businessSearch;

  // Get child categories for selected parent
  const selectedParentCategory = categoriesData?.find((c) => c.id === formData.primaryCategoryId);
  const childCategories = selectedParentCategory?.children || [];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.businessId && !businessSearch.trim()) {
      alert('Please select or enter a business name');
      return;
    }
    if (!formData.cardId) {
      alert('Please select a card');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!formData.startDate) {
      alert('Please select a start date');
      return;
    }
    if (!formData.noEndDate && !formData.endDate) {
      alert('Please select an end date or check "No end date"');
      return;
    }

    // Prepare submission data
    const submitData: SubscriptionFormData = {
      ...formData,
      // Send businessName only when creating a new business (no businessId)
      businessName: formData.businessId ? businessDisplayValue : businessSearch.trim(),
      endDate: formData.noEndDate ? null : formData.endDate,
      backfillTransactionIds: selectedTransactionIds,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Subscription Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Subscription Name (Optional)</Label>
        <Input
          id="name"
          type="text"
          placeholder="e.g., Netflix Premium, Spotify Family"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      {/* Business Combobox */}
      <div className="space-y-2">
        <Label htmlFor="business">Business *</Label>
        <Popover open={businessOpen} onOpenChange={setBusinessOpen} modal={true}>
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
                          setFormData(prev => ({ ...prev, businessId: null }));
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
                        setFormData(prev => ({
                          ...prev,
                          businessId: business.id,
                          primaryCategoryId: business.primary_category?.id || null,
                          childCategoryId: business.child_category?.id || null,
                        }));
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

      {/* Card Selection */}
      <div className="space-y-2">
        <Label htmlFor="card">Card *</Label>
        {cardsLoading ? (
          <div className="text-sm text-muted-foreground">Loading cards...</div>
        ) : cardsError ? (
          <div className="text-sm text-red-500">Error loading cards: {cardsError.message}</div>
        ) : !cardsData || cardsData.length === 0 ? (
          <div className="text-sm text-yellow-600">No cards found. Please add a card first.</div>
        ) : (
          <Select
            key="card-select"
            value={formData.cardId?.toString() || ''}
            onValueChange={(value) => {
              const cardId = value ? parseInt(value, 10) : null;
              setFormData(prev => ({ ...prev, cardId }));
            }}
          >
            <SelectTrigger id="card" className="w-full">
              <SelectValue placeholder="Select a card" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] z-[100]">
              {cardsData.map((card) => (
                <SelectItem key={card.id} value={card.id.toString()}>
                  {card.nickname || card.bankOrCompany || 'Card'} ****{card.last4}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Amount and Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount || ''}
            onChange={(e) =>
              setFormData(prev => ({ ...prev, amount: e.target.value ? parseFloat(e.target.value) : null }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select key="currency-select" value={formData.currency} onValueChange={(value: 'ILS' | 'USD' | 'EUR') => setFormData(prev => ({ ...prev, currency: value }))}>
            <SelectTrigger id="currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="ILS">ILS (₪)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <Label>Frequency *</Label>
        <RadioGroup
          value={formData.frequency}
          onValueChange={(value: 'monthly' | 'annual') => setFormData(prev => ({ ...prev, frequency: value }))}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="monthly" id="monthly" />
            <Label htmlFor="monthly" className="font-normal cursor-pointer">
              Monthly
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="annual" id="annual" />
            <Label htmlFor="annual" className="font-normal cursor-pointer">
              Annual
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <Label>Start Date *</Label>
        <DatePicker
          value={formData.startDate}
          onChange={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
          placeholder="Select start date"
        />
      </div>

      {/* End Date */}
      <div className="space-y-2">
        <Label>End Date</Label>
        <div className="space-y-3">
          <DatePicker
            value={formData.endDate || ''}
            onChange={(date) => setFormData(prev => ({ ...prev, endDate: date, noEndDate: false }))}
            placeholder="Select end date"
            disabled={formData.noEndDate}
            disabledDates={(date) => formData.startDate ? date < new Date(formData.startDate) : false}
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              id="noEndDate"
              checked={formData.noEndDate}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, noEndDate: !!checked, endDate: checked ? null : prev.endDate }))
              }
            />
            <Label htmlFor="noEndDate" className="font-normal cursor-pointer">
              No end date (open-ended subscription)
            </Label>
          </div>
        </div>
      </div>

      {/* Category Selection */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="primaryCategory">Primary Category</Label>
          <Select
            key="primary-category-select"
            value={formData.primaryCategoryId?.toString() || ''}
            onValueChange={(value) => {
              const primaryCategoryId = value ? parseInt(value, 10) : null;
              setFormData(prev => ({
                ...prev,
                primaryCategoryId,
                childCategoryId: null, // Reset child when parent changes
              }));
            }}
          >
            <SelectTrigger id="primaryCategory" className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] z-[100]">
              {categoriesData?.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="childCategory">Subcategory</Label>
          <Select
            key="child-category-select"
            value={formData.childCategoryId?.toString() || ''}
            onValueChange={(value) => {
              const childCategoryId = value ? parseInt(value, 10) : null;
              setFormData(prev => ({ ...prev, childCategoryId }));
            }}
            disabled={!formData.primaryCategoryId || childCategories.length === 0}
          >
            <SelectTrigger id="childCategory" className="w-full">
              <SelectValue placeholder="Select subcategory" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] z-[100]">
              {childCategories.map((child) => (
                <SelectItem key={child.id} value={child.id.toString()}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Backfill Selector */}
      <SubscriptionBackfillSelector
        businessId={formData.businessId}
        businessName={businessDisplayValue}
        cardId={formData.cardId}
        startDate={formData.startDate}
        onSelectionChange={setSelectedTransactionIds}
        initialSelectedIds={initialData?.initialBackfillIds}
      />

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any additional notes..."
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Creating...' : 'Create Subscription'}
        </Button>
      </div>
    </form>
  );
}
