import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles, transactions } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  batchIds: z.array(z.number()).min(1, 'At least one batch ID is required'),
  installmentStrategy: z.enum(['delete_matching', 'delete_all', 'skip']).optional(),
});

type InstallmentStrategy = 'delete_matching' | 'delete_all' | 'skip';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { batchIds, installmentStrategy } = validation.data;

    // Fetch all batches to verify they exist
    const batches = await db.query.uploadBatches.findMany({
      where: inArray(uploadBatches.id, batchIds),
    });

    if (batches.length !== batchIds.length) {
      return NextResponse.json(
        { error: 'Some batches not found' },
        { status: 404 }
      );
    }

    // Fetch all transactions across all batches
    const allBatchTransactions = await db.query.transactions.findMany({
      where: inArray(transactions.uploadBatchId, batchIds),
      with: {
        business: true,
      },
    });

    // Group transactions by installmentGroupId
    const installmentGroups = new Map<string, typeof allBatchTransactions>();
    const oneTimeTransactions: typeof allBatchTransactions = [];

    allBatchTransactions.forEach(tx => {
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
          businessName: batchTxs[0]?.business?.displayName || batchTxs[0]?.business?.name || 'Unknown',
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
        batchInfo: batches.map(b => ({
          id: b.id,
          fileCount: b.fileCount || 0,
          totalTransactions: allBatchTransactions.filter(tx => tx.uploadBatchId === b.id).length,
        })),
        oneTimeTransactions: oneTimeTransactions.length,
        partialInstallments,
      }, { status: 400 });
    }

    // Stage 2: Execute deletion based on strategy
    let totalDeletedTransactions = 0;
    let totalDeletedFiles = 0;

    if (!installmentStrategy || installmentStrategy === 'delete_matching') {
      // Delete only transactions in these batches
      const deleted = await db.delete(transactions)
        .where(inArray(transactions.uploadBatchId, batchIds))
        .returning();
      totalDeletedTransactions = deleted.length;
    } else if (installmentStrategy === 'delete_all') {
      // Delete entire installment groups
      for (const groupId of installmentGroups.keys()) {
        const deleted = await db.delete(transactions)
          .where(eq(transactions.installmentGroupId, groupId))
          .returning();
        totalDeletedTransactions += deleted.length;
      }
      // Also delete one-time transactions
      for (const tx of oneTimeTransactions) {
        await db.delete(transactions).where(eq(transactions.id, tx.id));
        totalDeletedTransactions++;
      }
    } else if (installmentStrategy === 'skip') {
      // Only delete one-time transactions
      for (const tx of oneTimeTransactions) {
        await db.delete(transactions).where(eq(transactions.id, tx.id));
        totalDeletedTransactions++;
      }
    }

    // Delete all uploaded files from these batches
    const deletedFiles = await db.delete(uploadedFiles)
      .where(inArray(uploadedFiles.uploadBatchId, batchIds))
      .returning();
    totalDeletedFiles = deletedFiles.length;

    // Delete the batches themselves
    await db.delete(uploadBatches)
      .where(inArray(uploadBatches.id, batchIds));

    logger.info({
      batchIds,
      deletedBatches: batchIds.length,
      deletedTransactions: totalDeletedTransactions,
      deletedFiles: totalDeletedFiles,
      installmentStrategy,
    }, 'Bulk batch deletion completed');

    return NextResponse.json({
      success: true,
      deletedBatches: batchIds.length,
      deletedTransactions: totalDeletedTransactions,
      deletedFiles: totalDeletedFiles,
    });

  } catch (error) {
    logger.error(error, 'Failed to bulk delete batches');
    return NextResponse.json(
      { error: 'Failed to bulk delete batches' },
      { status: 500 }
    );
  }
}
