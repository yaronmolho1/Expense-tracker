import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles, cards, transactions } from '@/lib/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import logger from '@/lib/logger';

export async function GET() {
  try {
    // Fetch all upload batches with their files and card information
    const batches = await db.query.uploadBatches.findMany({
      with: {
        files: {
          with: {
            card: true,
          },
        },
      },
      orderBy: [desc(uploadBatches.uploadedAt)],
      limit: 50, // Pagination limit
    });

    // Count transactions for each file dynamically
    const formattedBatches = await Promise.all(
      batches.map(async (batch) => {
        const filesWithCounts = await Promise.all(
          batch.files.map(async (file) => {
            // Count transactions by sourceFile + uploadBatchId
            const result = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(transactions)
              .where(
                and(
                  eq(transactions.sourceFile, file.filename),
                  eq(transactions.uploadBatchId, file.uploadBatchId)
                )
              );

            const count = Number(result[0]?.count || 0);
            logger.info(`Batch ${batch.id}, File ${file.id} (${file.filename}): ${count} transactions`);

            return {
              id: file.id,
              filename: file.filename,
              cardId: file.cardId,
              cardLast4: file.card?.last4Digits || null,
              transactionsFound: count,
              status: file.status,
            };
          })
        );

        return {
          id: batch.id,
          uploadedAt: batch.uploadedAt.toISOString(),
          fileCount: batch.fileCount || 0,
          totalTransactions: batch.totalTransactions || 0,
          newTransactions: batch.newTransactions || 0,
          updatedTransactions: batch.updatedTransactions || 0,
          status: batch.status,
          files: filesWithCounts,
        };
      })
    );

    logger.info(`Returning ${formattedBatches.length} batches`);
    return NextResponse.json({ batches: formattedBatches });
  } catch (error) {
    logger.error(error, 'Failed to fetch upload batches');
    return NextResponse.json(
      { error: 'Failed to fetch upload batches' },
      { status: 500 }
    );
  }
}
