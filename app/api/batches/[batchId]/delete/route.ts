import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles, transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';

type RouteParams = {
  params: Promise<{
    batchId: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { batchId } = await params;
    const batchIdNum = parseInt(batchId, 10);

    if (isNaN(batchIdNum)) {
      return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 });
    }

    // Check if batch exists
    const batch = await db.query.uploadBatches.findFirst({
      where: eq(uploadBatches.id, batchIdNum),
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Delete all transactions from this batch
    const deletedTransactions = await db.delete(transactions)
      .where(eq(transactions.uploadBatchId, batchIdNum))
      .returning();

    // Delete all uploaded files from this batch
    const deletedFiles = await db.delete(uploadedFiles)
      .where(eq(uploadedFiles.uploadBatchId, batchIdNum))
      .returning();

    // Delete the batch itself
    await db.delete(uploadBatches)
      .where(eq(uploadBatches.id, batchIdNum));

    logger.info({
      batchId: batchIdNum,
      deletedTransactions: deletedTransactions.length,
      deletedFiles: deletedFiles.length,
    }, 'Batch deleted');

    return NextResponse.json({
      success: true,
      deletedTransactions: deletedTransactions.length,
      deletedFiles: deletedFiles.length,
    });

  } catch (error) {
    logger.error(error, 'Failed to delete batch');
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 });
  }
}
