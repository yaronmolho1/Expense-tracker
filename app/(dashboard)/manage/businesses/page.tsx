'use client';

import { useState } from 'react';
import { BusinessCatalogTable } from '@/components/features/manage/business-catalog-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitMerge, History, Scan } from 'lucide-react';
import Link from 'next/link';
import { useMergeSuggestions } from '@/hooks/use-merge-suggestions';
import { useMergedBusinesses } from '@/hooks/use-merged-businesses';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function ManageBusinessesPage() {
  const [isDetecting, setIsDetecting] = useState(false);
  const queryClient = useQueryClient();
  const { data: suggestionsData } = useMergeSuggestions();
  const { data: mergedData } = useMergedBusinesses();
  const suggestionCount = suggestionsData?.suggestions.length || 0;
  const mergedCount = mergedData?.total || 0;

  const handleDetectMerges = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch('/api/businesses/detect-merges', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to detect business merges');
      }

      const data = await response.json();

      toast.success('Business merge detection complete!', {
        description: `Found ${data.suggestionsCreated} potential merge suggestions`,
      });

      // Refresh suggestions
      queryClient.invalidateQueries({ queryKey: ['merge-suggestions'] });
    } catch (error) {
      console.error('Failed to detect business merges:', error);
      toast.error('Failed to detect business merges', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Businesses</h1>
          <p className="text-muted-foreground mt-2">
            View all businesses, edit categories, and approve categorizations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDetectMerges} disabled={isDetecting}>
            <Scan className="h-4 w-4 mr-2" />
            {isDetecting ? 'Detecting...' : 'Detect Merges'}
          </Button>
          <Link href="/manage/businesses/merged">
            <Button variant="outline">
              <History className="h-4 w-4 mr-2" />
              Merged History
              {mergedCount > 0 && (
                <span className="ml-2 bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                  {mergedCount}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/manage/businesses/suggestions">
            <Button>
              <GitMerge className="h-4 w-4 mr-2" />
              Merge Suggestions
              {suggestionCount > 0 && (
                <span className="ml-2 bg-primary-foreground text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                  {suggestionCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Catalog</CardTitle>
          <CardDescription>
            View all businesses, edit categories, and approve categorizations.
            Unapproved businesses may need manual category review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessCatalogTable />
        </CardContent>
      </Card>
    </div>
  );
}
