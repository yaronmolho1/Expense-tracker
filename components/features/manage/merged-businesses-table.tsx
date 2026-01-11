'use client';

import { useState } from 'react';
import { useMergedBusinesses, useUnmergeBusiness } from '@/hooks/use-merged-businesses';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight, Undo2 } from 'lucide-react';
import { format } from 'date-fns';

export function MergedBusinessesTable() {
  const { data, isLoading } = useMergedBusinesses();
  const unmergeBusiness = useUnmergeBusiness();
  const [unmergeConfirmId, setUnmergeConfirmId] = useState<number | null>(null);

  const handleUnmergeClick = (businessId: number) => {
    setUnmergeConfirmId(businessId);
  };

  const handleConfirmUnmerge = async () => {
    if (!unmergeConfirmId) return;

    try {
      await unmergeBusiness.mutateAsync(unmergeConfirmId);
      setUnmergeConfirmId(null);
    } catch (error) {
      console.error('Failed to unmerge business:', error);
    }
  };

  const selectedBusiness = data?.merged_businesses.find(b => b.id === unmergeConfirmId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Merged Businesses</h2>
          <p className="text-muted-foreground">
            Audit trail of all merged businesses
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Original Business</TableHead>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[250px]">Merged To</TableHead>
              <TableHead className="w-[150px]">Merge Date</TableHead>
              <TableHead className="w-[120px] text-center">Target Transactions</TableHead>
              <TableHead className="w-[100px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading merged businesses...
                </TableCell>
              </TableRow>
            ) : !data || data.merged_businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No merged businesses found.
                </TableCell>
              </TableRow>
            ) : (
              data.merged_businesses.map((business) => (
                <TableRow key={business.id}>
                  {/* Original Business */}
                  <TableCell>
                    <div>
                      <div className="font-medium">{business.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {business.normalized_name}
                      </div>
                    </div>
                  </TableCell>

                  {/* Arrow */}
                  <TableCell className="text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableCell>

                  {/* Target Business */}
                  <TableCell>
                    <div>
                      <div className="font-medium">{business.target_business_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {business.target_normalized_name}
                      </div>
                    </div>
                  </TableCell>

                  {/* Merge Date */}
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(business.merged_at), 'dd/MM/yyyy HH:mm')}
                    </div>
                  </TableCell>

                  {/* Transaction Count */}
                  <TableCell className="text-center">
                    <div className="text-sm font-medium">
                      {business.target_transaction_count.toLocaleString()}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnmergeClick(business.id)}
                      disabled={unmergeBusiness.isPending}
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Unmerge
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
          Showing {data.total} merged {data.total === 1 ? 'business' : 'businesses'}
        </div>
      )}

      {/* Unmerge Confirmation Dialog */}
      <AlertDialog open={!!unmergeConfirmId} onOpenChange={(open) => !open && setUnmergeConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unmerge Business?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore <strong>{selectedBusiness?.display_name}</strong> as an active business.
              <br /><br />
              {selectedBusiness && selectedBusiness.original_transaction_count > 0 ? (
                <>
                  <strong>{selectedBusiness.original_transaction_count} transaction{selectedBusiness.original_transaction_count !== 1 ? 's' : ''}</strong> will be moved back automatically.
                </>
              ) : (
                <>
                  <strong>Note:</strong> This business was merged before transaction tracking was added.
                  No transactions will be moved back.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unmergeBusiness.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnmerge}
              disabled={unmergeBusiness.isPending}
            >
              {unmergeBusiness.isPending ? 'Unmerging...' : 'Confirm Unmerge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
