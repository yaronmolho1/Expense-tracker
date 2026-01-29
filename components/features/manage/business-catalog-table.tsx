'use client';

import { useState } from 'react';
import { useBusinesses, useUpdateBusiness, useDeleteBusiness, type BusinessFilters } from '@/hooks/use-businesses';
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
import { DeleteBusinessDialog } from '@/components/features/manage/delete-business-dialog';
import { BusinessDetailModal } from '@/components/features/manage/business-detail-modal';
import { BusinessFilters as BusinessFiltersComponent } from '@/components/features/manage/business-filters';
import { BulkActionsToolbar } from '@/components/features/manage/bulk-actions-toolbar';
import { BulkCategoryDialog } from '@/components/features/manage/bulk-category-dialog';
import { GitMerge, Pencil, Check, X, ArrowUp, ArrowDown, ArrowUpDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type SortField = 'name' | 'total_spent' | 'transaction_count' | 'last_used_date' | 'primary_category';
type SortDirection = 'asc' | 'desc';
type ApprovalFilter = 'all' | 'approved' | 'unapproved' | 'uncategorized';

interface BusinessCatalogTableProps {
  showManualMerge?: boolean;
  onManualMergeClose?: () => void;
}

export function BusinessCatalogTable({ showManualMerge, onManualMergeClose }: BusinessCatalogTableProps = {}) {
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


  // NEW: Bulk category dialog state
  const [showBulkCategoryDialog, setShowBulkCategoryDialog] = useState(false);
  const [showManualMergeDialog, setShowManualMergeDialog] = useState(false);

  // Display name editing state
  const [editingBusinessId, setEditingBusinessId] = useState<number | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');

  // Delete business state
  const [deleteBusinessId, setDeleteBusinessId] = useState<number | null>(null);
  const [deleteBusinessName, setDeleteBusinessName] = useState('');

  // NEW: Multi-select state
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<Set<number>>(new Set());

  // Mobile detail modal state - store ID only to always use fresh data
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

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
  const deleteBusiness = useDeleteBusiness();

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
    setShowManualMergeDialog(true);
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

  // Delete handlers
  const handleDeleteClick = (businessId: number, businessName: string) => {
    setDeleteBusinessId(businessId);
    setDeleteBusinessName(businessName);
  };

  const handleDeleteConfirm = async (businessId: number, deleteMerged: boolean) => {
    try {
      await deleteBusiness.mutateAsync({ businessId, deleteMerged });
      toast.success('Business deleted successfully');
      setDeleteBusinessId(null);
      setDeleteBusinessName('');
    } catch (error) {
      console.error('Failed to delete business:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete business');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteBusinessId(null);
    setDeleteBusinessName('');
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

  // Mobile row click handler
  const handleRowClick = (business: any) => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      setSelectedBusinessId(business.id);
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

      {/* Table (sortable headers removed, sort now in filter dropdown) */}
      <div className="border rounded-lg mt-4 sm:mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] sm:w-[60px]">
                <Checkbox
                  className="h-5 w-5 sm:h-4 sm:w-4"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={!data || data.businesses.length === 0}
                />
              </TableHead>
              <SortableHeader field="name" className="w-[330px]">Business Name</SortableHeader>
              <SortableHeader field="primary_category" className="w-[140px] hidden md:table-cell">Category</SortableHeader>
              <SortableHeader field="transaction_count" className="w-[120px] text-center hidden md:table-cell">Transactions</SortableHeader>
              <SortableHeader field="total_spent" className="w-[140px] text-right">Total Spent</SortableHeader>
              <SortableHeader field="last_used_date" className="w-[120px] ml-6 hidden md:table-cell">Last Used</SortableHeader>
              <TableHead className="w-[100px] text-center hidden md:table-cell">Approved</TableHead>
              <TableHead className="w-[80px] text-center hidden md:table-cell">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading businesses...
                </TableCell>
              </TableRow>
            ) : !data || data.businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No businesses found.
                </TableCell>
              </TableRow>
            ) : (
              data.businesses.map((business) => (
                <TableRow
                  key={business.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(business)}
                >
                  <TableCell className="px-3 sm:px-4">
                    <Checkbox
                      className="h-5 w-5 sm:h-4 sm:w-4"
                      checked={selectedBusinessIds.has(business.id)}
                      onCheckedChange={(checked) => handleSelectBusiness(business.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3">
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
                      <>
                        {/* Mobile: Simple display, no inline editing */}
                        <div className="md:hidden">
                          <div className="font-medium">
                            {business.display_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {business.normalized_name}
                          </div>
                        </div>

                        {/* Desktop: Inline editing on hover */}
                        <div
                          className="hidden md:block group relative cursor-pointer"
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
                      </>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                    <InlineCategoryEditor
                      businessId={business.id}
                      businessName={business.display_name}
                      currentPrimaryCategory={business.primary_category?.name || null}
                      currentChildCategory={business.child_category?.name || null}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3 text-center hidden md:table-cell">
                    {business.transaction_count}
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3 text-right font-medium">
                    <span className="text-xs">₪</span>{business.total_spent.toLocaleString('en-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-muted-foreground ml-6 hidden md:table-cell">
                    {business.last_used_date
                      ? new Date(business.last_used_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3 text-center hidden md:table-cell">
                    <Checkbox
                      checked={business.approved}
                      onCheckedChange={() => handleApprovedToggle(business.id, business.approved)}
                      disabled={updateBusiness.isPending}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 sm:px-4 sm:py-3 text-center hidden md:table-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(business.id, business.display_name);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
        open={showManualMerge || showManualMergeDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowManualMergeDialog(false);
            if (onManualMergeClose) {
              onManualMergeClose();
            }
          }
        }}
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

      {/* Delete Business Dialog */}
      <DeleteBusinessDialog
        businessId={deleteBusinessId}
        businessName={deleteBusinessName}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={deleteBusiness.isPending}
      />

      {/* Business Detail Modal (Mobile) */}
      <BusinessDetailModal
        isOpen={!!selectedBusinessId}
        onClose={() => setSelectedBusinessId(null)}
        business={selectedBusinessId ? data?.businesses.find(b => b.id === selectedBusinessId) || null : null}
        onEdit={(business) => {
          handleEditDisplayName(business.id, business.display_name);
          setSelectedBusinessId(null);
        }}
        onDelete={(business) => {
          handleDeleteClick(business.id, business.display_name);
          setSelectedBusinessId(null);
        }}
        onSetCategory={() => {
          // The inline category editor is already in the table
          // We'll close the modal and let the user use it directly
          setSelectedBusinessId(null);
          toast.info('Use the category field in the table to set category');
        }}
        onApprove={(business) => {
          handleApprovedToggle(business.id, business.approved);
          setSelectedBusinessId(null);
        }}
      />
    </div>
  );
}
