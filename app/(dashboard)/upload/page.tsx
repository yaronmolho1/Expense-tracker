'use client';

import { useState } from 'react';
import { FileUploadZone } from '@/components/features/upload/file-upload-zone';
import { UploadProgress } from '@/components/features/upload/upload-progress';

export default function UploadPage() {
  const [batchId, setBatchId] = useState<number | null>(null);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Upload Bank Statements</h1>

      {!batchId ? (
        <FileUploadZone onUploadComplete={setBatchId} />
      ) : (
        <UploadProgress batchId={batchId} onReset={() => setBatchId(null)} />
      )}
    </div>
  );
}
