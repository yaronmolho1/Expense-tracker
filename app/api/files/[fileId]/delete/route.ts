import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedFiles, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';

type RouteParams = {
  params: Promise<{
    fileId: string;
  }>;
};

type InstallmentStrategy = 'delete_matching' | 'delete_all' | 'skip';

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { fileId } = await params;
    const fileIdNum = parseInt(fileId, 10);

    if (isNaN(fileIdNum)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get query params
    const url = new URL(request.url);
    const installmentStrategy = url.searchParams.get('installmentStrategy') as InstallmentStrategy | null;

    // Find the file
    const file = await db.query.uploadedFiles.findFirst({
      where: eq(uploadedFiles.id, fileIdNum),
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get all transactions from this file (by sourceFile and batchId)
    const fileTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.sourceFile, file.filename),
        eq(transactions.uploadBatchId, file.uploadBatchId)
      ),
      with: {
        business: true,
      },
    });

    if (fileTransactions.length === 0) {
      // No transactions, just delete the file record
      await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileIdNum));
      return NextResponse.json({
        success: true,
        deletedTransactions: 0,
        deletedFiles: 1,
      });
    }

    // Group by installment groups
    const installmentGroups = new Map<string, typeof fileTransactions>();
    const oneTimeTransactions: typeof fileTransactions = [];

    for (const tx of fileTransactions) {
      if (tx.installmentGroupId) {
        if (!installmentGroups.has(tx.installmentGroupId)) {
          installmentGroups.set(tx.installmentGroupId, []);
        }
        installmentGroups.get(tx.installmentGroupId)!.push(tx);
      } else {
        oneTimeTransactions.push(tx);
      }
    }

    // Check for partial installment groups
    const partialInstallments = [];
    for (const [groupId, fileTxs] of installmentGroups.entries()) {
      const installmentTotal = fileTxs[0]?.installmentTotal || 0;

      // Get all transactions in this installment group
      const allInGroup = await db.query.transactions.findMany({
        where: eq(transactions.installmentGroupId, groupId),
        orderBy: (transactions, { asc }) => [asc(transactions.installmentIndex)],
      });

      // Check if this is a partial group
      if (allInGroup.length > fileTxs.length || fileTxs.length < installmentTotal) {
        partialInstallments.push({
          groupId,
          businessName: (fileTxs[0]?.business as any)?.displayName || 'Unknown',
          inFile: fileTxs.length,
          total: installmentTotal,
          allPayments: allInGroup.map(tx => ({
            index: tx.installmentIndex || 0,
            amount: parseFloat(tx.chargedAmountIls || '0'),
            date: tx.dealDate,
            status: (tx.sourceFile === file.filename && tx.uploadBatchId === file.uploadBatchId) ? 'in_this_file' : 'completed',
            inThisFile: (tx.sourceFile === file.filename && tx.uploadBatchId === file.uploadBatchId),
          })),
        });
      }
    }

    // Stage 1: If there are partial installments and no strategy specified, return warnings
    if (partialInstallments.length > 0 && !installmentStrategy) {
      return NextResponse.json({
        requiresConfirmation: true,
        fileInfo: {
          id: fileIdNum,
          filename: file.filename,
          totalTransactions: fileTransactions.length,
        },
        oneTimeTransactions: oneTimeTransactions.length,
        partialInstallments,
      }, { status: 400 });
    }

    // Stage 2: Execute deletion based on strategy
    let transactionIdsToDelete: number[] = [];

    // Always delete one-time transactions
    transactionIdsToDelete.push(...oneTimeTransactions.map(tx => tx.id));

    // Handle installment groups based on strategy
    for (const [groupId, fileTxs] of installmentGroups.entries()) {
      const isPartial = partialInstallments.some(p => p.groupId === groupId);

      if (!isPartial) {
        // Complete group in this file - delete all
        transactionIdsToDelete.push(...fileTxs.map(tx => tx.id));
      } else {
        // Partial group - apply strategy
        if (installmentStrategy === 'delete_all') {
          // Delete all transactions in the installment group
          const allInGroup = await db.query.transactions.findMany({
            where: eq(transactions.installmentGroupId, groupId),
          });
          transactionIdsToDelete.push(...allInGroup.map(tx => tx.id));
        } else if (installmentStrategy === 'delete_matching') {
          // Delete only transactions from this file
          transactionIdsToDelete.push(...fileTxs.map(tx => tx.id));
        }
        // 'skip' strategy: don't add these transactions to delete list
      }
    }

    // Delete transactions
    let deletedCount = 0;
    if (transactionIdsToDelete.length > 0) {
      for (const txId of transactionIdsToDelete) {
        await db.delete(transactions).where(eq(transactions.id, txId));
        deletedCount++;
      }
    }

    // Delete the file record
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileIdNum));

    logger.info(`Deleted file ${fileIdNum} and ${deletedCount} transactions`);

    return NextResponse.json({
      success: true,
      deletedTransactions: deletedCount,
      deletedFiles: 1,
    });
  } catch (error) {
    logger.error(error, 'Failed to delete file');
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
