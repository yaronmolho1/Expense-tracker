'use client';

import { useState } from 'react';
import { MergeSuggestionsTable } from '@/components/features/manage/merge-suggestions-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scan } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';

export default function MergeSuggestionsPage() {
  const [isDetecting, setIsDetecting] = useState(false);
  const queryClient = useQueryClient();

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
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Business Merge Suggestions"
        description="Review automatically detected duplicate businesses"
        actions={
          <>
            <Link href="/manage/businesses">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Button onClick={handleDetectMerges} disabled={isDetecting}>
              <Scan className="h-4 w-4 mr-2" />
              {isDetecting ? 'Detecting...' : 'Detect Merges'}
            </Button>
          </>
        }
      />

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
