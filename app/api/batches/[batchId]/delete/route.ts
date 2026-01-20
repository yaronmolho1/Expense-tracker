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

type InstallmentStrategy = 'delete_matching' | 'delete_all' | 'skip';

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

    // Get installmentStrategy from query params
    const { searchParams } = new URL(request.url);
    const installmentStrategy = searchParams.get('installmentStrategy') as InstallmentStrategy | null;

    // Check if batch exists
    const batch = await db.query.uploadBatches.findFirst({
      where: eq(uploadBatches.id, batchIdNum),
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Fetch all transactions in this batch with business information
    const batchTransactions = await db.query.transactions.findMany({
      where: eq(transactions.uploadBatchId, batchIdNum),
      with: {
        business: true,
      },
    });

    // Group transactions by installmentGroupId
    const installmentGroups = new Map<string, typeof batchTransactions>();
    const oneTimeTransactions: typeof batchTransactions = [];

    batchTransactions.forEach(tx => {
      if (tx.installmentGroupId) {
        const group = installmentGroups.get(tx.installmentGroupId) || [];
        group.push(tx);
        installmentGroups.set(tx.installmentGroupId, group);
      } else {
        oneTimeTransactions.push(tx);
      }
    });

    // Analyze partial installment groups
    const partialInstallments = [];
    for (const [groupId, batchTxs] of installmentGroups.entries()) {
      // Fetch ALL transactions in this installment group
      const allInGroup = await db.query.transactions.findMany({
        where: eq(transactions.installmentGroupId, groupId),
        orderBy: (transactions, { asc }) => [asc(transactions.installmentIndex)],
      });

      // Check if this is a partial group
      const installmentTotal = batchTxs[0]?.installmentTotal || 0;
      if (allInGroup.length > batchTxs.length || batchTxs.length < installmentTotal) {
        partialInstallments.push({
          groupId,
          businessName: (batchTxs[0]?.business as any)?.displayName || 'Unknown',
          inBatch: batchTxs.length,
          total: installmentTotal,
          allPayments: allInGroup.map(tx => ({
            index: tx.installmentIndex || 0,
            amount: parseFloat(tx.chargedAmountIls || '0'),
            dealDate: tx.dealDate,
            status: tx.status,
            inThisBatch: batchTxs.some(b => b.id === tx.id),
          })),
        });
      }
    }

    // Stage 1: If there are partial installments and no strategy specified, return warnings
    if (partialInstallments.length > 0 && !installmentStrategy) {
      return NextResponse.json({
        requiresConfirmation: true,
        batchInfo: {
          id: batchIdNum,
          fileCount: batch.fileCount || 0,
          totalTransactions: batchTransactions.length,
        },
        oneTimeTransactions: oneTimeTransactions.length,
        partialInstallments,
      }, { status: 400 });
    }

    // Stage 2: Execute deletion based on strategy
    let deletedCount = 0;

    if (!installmentStrategy || installmentStrategy === 'delete_matching') {
      // Delete only transactions in this batch
      const deleted = await db.delete(transactions)
        .where(eq(transactions.uploadBatchId, batchIdNum))
        .returning();
      deletedCount = deleted.length;
    } else if (installmentStrategy === 'delete_all') {
      // Delete entire installment groups
      for (const groupId of installmentGroups.keys()) {
        const deleted = await db.delete(transactions)
          .where(eq(transactions.installmentGroupId, groupId))
          .returning();
        deletedCount += deleted.length;
      }
      // Also delete one-time transactions
      for (const tx of oneTimeTransactions) {
        await db.delete(transactions).where(eq(transactions.id, tx.id));
        deletedCount++;
      }
    } else if (installmentStrategy === 'skip') {
      // Only delete one-time transactions
      for (const tx of oneTimeTransactions) {
        await db.delete(transactions).where(eq(transactions.id, tx.id));
        deletedCount++;
      }
    }

    // Delete all uploaded files from this batch
    const deletedFiles = await db.delete(uploadedFiles)
      .where(eq(uploadedFiles.uploadBatchId, batchIdNum))
      .returning();

    // Delete the batch itself
    await db.delete(uploadBatches)
      .where(eq(uploadBatches.id, batchIdNum));

    logger.info({
      batchId: batchIdNum,
      deletedTransactions: deletedCount,
      deletedFiles: deletedFiles.length,
      installmentStrategy,
    }, 'Batch deleted');

    return NextResponse.json({
      success: true,
      deletedTransactions: deletedCount,
      deletedFiles: deletedFiles.length,
    });

  } catch (error) {
    logger.error(error, 'Failed to delete batch');
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 });
  }
}
