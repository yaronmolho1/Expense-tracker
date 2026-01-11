'use client';

import { BusinessCatalogTable } from '@/components/features/manage/business-catalog-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitMerge, History } from 'lucide-react';
import Link from 'next/link';
import { useMergeSuggestions } from '@/hooks/use-merge-suggestions';
import { useMergedBusinesses } from '@/hooks/use-merged-businesses';

export default function ManageBusinessesPage() {
  const { data: suggestionsData } = useMergeSuggestions();
  const { data: mergedData } = useMergedBusinesses();
  const suggestionCount = suggestionsData?.suggestions.length || 0;
  const mergedCount = mergedData?.total || 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Businesses</h1>
          <p className="text-muted-foreground mt-2">
            Filter businesses by category and date range, edit categories, approve categorizations, and use bulk actions to merge duplicates or set categories
          </p>
        </div>
        <div className="flex gap-2">
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
            Filter by category and date range. Edit categories, approve categorizations, and use bulk actions to merge businesses or update categories.
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
