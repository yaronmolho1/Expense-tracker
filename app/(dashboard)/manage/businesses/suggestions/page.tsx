'use client';

import { MergeSuggestionsTable } from '@/components/features/manage/merge-suggestions-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function MergeSuggestionsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/manage/businesses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Business Merge Suggestions</h1>
          <p className="text-muted-foreground mt-2">
            Review automatically detected duplicate businesses
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Merge Suggestions</CardTitle>
          <CardDescription>
            Review automatically detected duplicate businesses. Select which one to keep,
            and all transactions will be merged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MergeSuggestionsTable />
        </CardContent>
      </Card>
    </div>
  );
}
