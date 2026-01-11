'use client';

import { useState, useRef, useEffect } from 'react';
import { useBusinesses, useUpdateBusiness } from '@/hooks/use-businesses';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InlineCategoryEditor } from '@/components/features/transactions/inline-category-editor';
import { ManualMergeDialog } from '@/components/features/manage/manual-merge-dialog';
import { Search, Filter, ArrowUp, ArrowDown, ChevronsUpDown, GitMerge, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SortField = 'name' | 'total_spent' | 'transaction_count' | 'last_used_date';
type SortDirection = 'asc' | 'desc';

export function BusinessCatalogTable() {
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'unapproved' | 'uncategorized'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Manual merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Display name editing state
  const [editingBusinessId, setEditingBusinessId] = useState<number | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');

  // Search input ref to maintain focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  const approvedOnly = approvalFilter === 'approved' ? true : approvalFilter === 'unapproved' ? false : undefined;
  const uncategorized = approvalFilter === 'uncategorized';

  // Build sort parameter for API
  const sortParam = sortField === 'name' && sortDirection === 'asc' ? 'name' :
                    sortField === 'name' && sortDirection === 'desc' ? 'name_desc' :
                    sortField === 'total_spent' && sortDirection === 'desc' ? 'total_spent' :
                    sortField === 'total_spent' && sortDirection === 'asc' ? 'total_spent_asc' :
                    sortField === 'transaction_count' && sortDirection === 'desc' ? 'transaction_count' :
                    sortField === 'transaction_count' && sortDirection === 'asc' ? 'transaction_count_asc' :
                    sortField === 'last_used_date' && sortDirection === 'desc' ? 'last_used_date' :
                    sortField === 'last_used_date' && sortDirection === 'asc' ? 'last_used_date_asc' :
                    'name';

  const { data, isLoading } = useBusinesses(search, approvedOnly, sortParam, uncategorized);
  const updateBusiness = useUpdateBusiness();

  // Maintain focus on search input when data updates
  useEffect(() => {
    if (searchInputRef.current && document.activeElement !== searchInputRef.current && search.length > 0) {
      searchInputRef.current.focus();
    }
  }, [data, search]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field - default direction based on field type
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 opacity-30" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="h-4 w-4" /> :
      <ArrowDown className="h-4 w-4" />;
  };

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={approvalFilter} onValueChange={(v: any) => setApprovalFilter(v)}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Businesses</SelectItem>
            <SelectItem value="approved">Approved Only</SelectItem>
            <SelectItem value="unapproved">Unapproved Only</SelectItem>
            <SelectItem value="uncategorized">Uncategorized Only</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowMergeDialog(true)} variant="default">
          <GitMerge className="h-4 w-4 mr-2" />
          Manual Merge
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  Business Name
                  {getSortIcon('name')}
                </button>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-[100px] text-center">
                <button
                  onClick={() => handleSort('transaction_count')}
                  className="flex items-center gap-2 mx-auto hover:text-foreground transition-colors"
                >
                  Transactions
                  {getSortIcon('transaction_count')}
                </button>
              </TableHead>
              <TableHead className="w-[120px] text-right">
                <button
                  onClick={() => handleSort('total_spent')}
                  className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                >
                  Total Spent
                  {getSortIcon('total_spent')}
                </button>
              </TableHead>
              <TableHead className="w-[120px]">
                <button
                  onClick={() => handleSort('last_used_date')}
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  Last Used
                  {getSortIcon('last_used_date')}
                </button>
              </TableHead>
              <TableHead className="w-[80px] text-center">Approved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading businesses...
                </TableCell>
              </TableRow>
            ) : !data || data.businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No businesses found.
                </TableCell>
              </TableRow>
            ) : (
              data.businesses.map((business) => (
                <TableRow key={business.id}>
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
      />
    </div>
  );
}
