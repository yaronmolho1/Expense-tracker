'use client';

import { useState } from 'react';
import { FileUploadZone } from '@/components/features/upload/file-upload-zone';
import { UploadProgress } from '@/components/features/upload/upload-progress';
import { PageHeader } from '@/components/ui/page-header';

export default function UploadPage() {
  const [batchId, setBatchId] = useState<number | null>(null);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <PageHeader title="Upload Bank Statements" />

      {!batchId ? (
        <FileUploadZone onUploadComplete={setBatchId} />
      ) : (
        <UploadProgress batchId={batchId} onReset={() => setBatchId(null)} />
      )}
    </div>
  );
}
