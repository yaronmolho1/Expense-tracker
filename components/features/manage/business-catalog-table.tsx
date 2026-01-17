'use client';

import { useState } from 'react';
import { useBusinesses, useUpdateBusiness, type BusinessFilters } from '@/hooks/use-businesses';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { InlineCategoryEditor } from '@/components/features/transactions/inline-category-editor';
import { ManualMergeDialog } from '@/components/features/manage/manual-merge-dialog';
import { BusinessFilters as BusinessFiltersComponent } from '@/components/features/manage/business-filters';
import { BulkActionsToolbar } from '@/components/features/manage/bulk-actions-toolbar';
import { BulkCategoryDialog } from '@/components/features/manage/bulk-category-dialog';
import { GitMerge, Pencil, Check, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type SortField = 'name' | 'total_spent' | 'transaction_count' | 'last_used_date' | 'primary_category';
type SortDirection = 'asc' | 'desc';
type ApprovalFilter = 'all' | 'approved' | 'unapproved' | 'uncategorized';

export function BusinessCatalogTable() {
  // NEW: Single filter state object
  const [filters, setFilters] = useState({
    search: '',
    approvalFilter: 'all' as ApprovalFilter,
    sortField: 'name' as SortField,
    sortDirection: 'asc' as SortDirection,
    parentCategoryIds: [] as string[],
    childCategoryIds: [] as string[],
    dateFrom: '',
    dateTo: '',
    uncategorized: false,
  });

  // Manual merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // NEW: Bulk category dialog state
  const [showBulkCategoryDialog, setShowBulkCategoryDialog] = useState(false);

  // Display name editing state
  const [editingBusinessId, setEditingBusinessId] = useState<number | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');

  // NEW: Multi-select state
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<Set<number>>(new Set());

  const handleFilterChange = (updates: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  // NEW: Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.businesses) {
      setSelectedBusinessIds(new Set(data.businesses.map(b => b.id)));
    } else {
      setSelectedBusinessIds(new Set());
    }
  };

  const handleSelectBusiness = (businessId: number, checked: boolean) => {
    setSelectedBusinessIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(businessId);
      } else {
        next.delete(businessId);
      }
      return next;
    });
  };

  // Build sort parameter for API
  const buildSortParam = (field: SortField, direction: SortDirection) => {
    if (field === 'name') return direction === 'asc' ? 'name' : 'name_desc';
    if (field === 'total_spent') return direction === 'desc' ? 'total_spent' : 'total_spent_asc';
    if (field === 'transaction_count') return direction === 'desc' ? 'transaction_count' : 'transaction_count_asc';
    if (field === 'last_used_date') return direction === 'desc' ? 'last_used_date' : 'last_used_date_asc';
    if (field === 'primary_category') return direction === 'asc' ? 'primary_category' : 'primary_category_desc';
    return 'name';
  };

  // Convert UI filters to API filters
  const apiFilters: BusinessFilters = {
    search: filters.search,
    approvedOnly: filters.approvalFilter === 'approved' ? true : filters.approvalFilter === 'unapproved' ? false : undefined,
    sort: buildSortParam(filters.sortField, filters.sortDirection),
    uncategorized: filters.uncategorized || filters.approvalFilter === 'uncategorized',
    parentCategoryIds: filters.parentCategoryIds.map(Number),
    childCategoryIds: filters.childCategoryIds.map(Number),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };

  const { data, isLoading } = useBusinesses(apiFilters);
  const updateBusiness = useUpdateBusiness();

  // Check if all visible businesses are selected (must be after data is defined)
  const allSelected = data?.businesses && data.businesses.length > 0 &&
    data.businesses.every(b => selectedBusinessIds.has(b.id));

  const handleApprovedToggle = async (businessId: number, currentApproved: boolean) => {
    try {
      await updateBusiness.mutateAsync({
        businessId,
        approved: !currentApproved,
      });
    } catch (error) {
      console.error('Failed to update business:', error);
    }
  };

  // Display name editing handlers
  const handleEditDisplayName = (businessId: number, currentName: string) => {
    setEditingBusinessId(businessId);
    setEditingDisplayName(currentName);
  };

  const handleSaveDisplayName = async (businessId: number) => {
    if (!editingDisplayName.trim()) return;

    try {
      await updateBusiness.mutateAsync({
        businessId,
        displayName: editingDisplayName.trim(),
      });
      setEditingBusinessId(null);
      setEditingDisplayName('');
    } catch (error) {
      console.error('Failed to update display name:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingBusinessId(null);
    setEditingDisplayName('');
  };

  // NEW: Bulk action handlers
  const handleBulkMerge = () => {
    if (selectedBusinessIds.size < 2) {
      toast.error('Please select at least 2 businesses to merge');
      return;
    }
    setShowMergeDialog(true);
  };

  const handleBulkSetCategory = () => {
    setShowBulkCategoryDialog(true);
  };

  const handleBulkCategorySuccess = () => {
    setSelectedBusinessIds(new Set()); // Clear selection after success
  };

  const handleBulkMergeSuccess = () => {
    setSelectedBusinessIds(new Set()); // Clear selection after merge
  };

  const handleClearSelection = () => {
    setSelectedBusinessIds(new Set());
  };

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (filters.sortField === field) {
      // Toggle direction if same field
      const newDirection = filters.sortDirection === 'asc' ? 'desc' : 'asc';
      handleFilterChange({ sortDirection: newDirection });
    } else {
      // Default direction for new field
      const defaultDirection = field === 'name' ? 'asc' : 'desc';
      handleFilterChange({ sortField: field, sortDirection: defaultDirection });
    }
  };

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => {
    const isActive = filters.sortField === field;
    const isAsc = filters.sortDirection === 'asc';

    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            isAsc ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-30" />
          )}
        </div>
      </TableHead>
    );
  };

  return (
    <div className="space-y-4">
      {/* NEW: Filters Component */}
      <BusinessFiltersComponent filters={filters} onFilterChange={handleFilterChange} />

      {/* Manual Merge Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowMergeDialog(true)} variant="default">
          <GitMerge className="h-4 w-4 mr-2" />
          Manual Merge
        </Button>
      </div>

      {/* Table (sortable headers removed, sort now in filter dropdown) */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={!data || data.businesses.length === 0}
                />
              </TableHead>
              <SortableHeader field="name" className="w-[300px]">Business Name</SortableHeader>
              <SortableHeader field="primary_category">Category</SortableHeader>
              <SortableHeader field="transaction_count" className="w-[100px] text-center">Transactions</SortableHeader>
              <SortableHeader field="total_spent" className="w-[120px] text-right">Total Spent</SortableHeader>
              <SortableHeader field="last_used_date" className="w-[120px]">Last Used</SortableHeader>
              <TableHead className="w-[80px] text-center">Approved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading businesses...
                </TableCell>
              </TableRow>
            ) : !data || data.businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No businesses found.
                </TableCell>
              </TableRow>
            ) : (
              data.businesses.map((business) => (
                <TableRow key={business.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedBusinessIds.has(business.id)}
                      onCheckedChange={(checked) => handleSelectBusiness(business.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    {editingBusinessId === business.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveDisplayName(business.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleSaveDisplayName(business.id)}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="group relative cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDisplayName(business.id, business.display_name);
                        }}
                      >
                        <div className="font-medium group-hover:opacity-60 transition-opacity">
                          {business.display_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {business.normalized_name}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white rounded-full p-1 shadow-md">
                            <Pencil className="h-3 w-3 text-gray-600" />
                          </div>
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <InlineCategoryEditor
                      businessId={business.id}
                      businessName={business.display_name}
                      currentPrimaryCategory={business.primary_category?.name || null}
                      currentChildCategory={business.child_category?.name || null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {business.transaction_count}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₪{business.total_spent.toLocaleString('en-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {business.last_used_date
                      ? new Date(business.last_used_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={business.approved}
                      onCheckedChange={() => handleApprovedToggle(business.id, business.approved)}
                      disabled={updateBusiness.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {data && data.total > 0 && (
        <div className="text-sm text-muted-foreground text-right">
          Showing {data.total} {data.total === 1 ? 'business' : 'businesses'}
        </div>
      )}

      {/* Manual Merge Dialog */}
      <ManualMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        preselectedBusinessIds={Array.from(selectedBusinessIds)}
        onSuccess={handleBulkMergeSuccess}
      />

      {/* NEW: Bulk Category Dialog */}
      <BulkCategoryDialog
        open={showBulkCategoryDialog}
        onOpenChange={setShowBulkCategoryDialog}
        businessIds={Array.from(selectedBusinessIds)}
        onSuccess={handleBulkCategorySuccess}
      />

      {/* NEW: Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedBusinessIds.size}
        onBulkMerge={handleBulkMerge}
        onBulkSetCategory={handleBulkSetCategory}
        onClear={handleClearSelection}
      />
    </div>
  );
}
