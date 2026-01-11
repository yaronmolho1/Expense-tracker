import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId: batchIdStr } = await params;
    const batchId = parseInt(batchIdStr);

    const batch = await db.query.uploadBatches.findFirst({
      where: eq(uploadBatches.id, batchId),
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const files = await db.query.uploadedFiles.findMany({
      where: eq(uploadedFiles.uploadBatchId, batchId),
    });

    const completedFiles = files.filter(f => f.status === 'completed').length;
    const progressPercent = (completedFiles / batch.fileCount) * 100;

    return NextResponse.json({
      id: batch.id,
      status: batch.status,
      progress_percent: Math.round(progressPercent),
      file_count: batch.fileCount,
      files: files.map(f => ({
        id: f.id,
        filename: f.filename,
        status: f.status,
        transactions_found: f.transactionsFound,
        error_message: f.errorMessage,
        validation_warning: f.validationWarning,
      })),
      summary: {
        total_transactions: batch.totalTransactions,
        new_transactions: batch.newTransactions,
        updated_transactions: batch.updatedTransactions,
        total_amount_ils: batch.totalAmountIls,
      },
      error_message: batch.errorMessage,
      processing_started_at: batch.processingStartedAt,
      processing_completed_at: batch.processingCompletedAt,
    });

  } catch (error) {
    console.error('Batch status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
