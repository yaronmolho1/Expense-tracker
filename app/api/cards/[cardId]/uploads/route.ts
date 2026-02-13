import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedFiles, transactions } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import logger from '@/lib/logger';

type RouteParams = {
  params: Promise<{
    cardId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  try {
    const { cardId } = await params;
    const cardIdNum = parseInt(cardId, 10);

    logger.info(`Fetching uploads for card ${cardIdNum}`);

    if (isNaN(cardIdNum)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
    }

    // Fetch all uploaded files for this card
    const files = await db.query.uploadedFiles.findMany({
      where: eq(uploadedFiles.cardId, cardIdNum),
      with: {
        uploadBatch: true,
      },
      orderBy: [desc(uploadedFiles.createdAt)],
    });

    logger.info(`Found ${files.length} files for card ${cardIdNum}`);

    // Count transactions for each file (by sourceFile filename)
    const transactionCounts = new Map<number, number>();

    for (const file of files) {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(
            eq(transactions.sourceFile, file.filename),
            eq(transactions.cardId, cardIdNum),
            eq(transactions.uploadBatchId, file.uploadBatchId)
          )
        );

      const count = Number(result[0]?.count || 0);
      transactionCounts.set(file.id, count);
      logger.info(`File ${file.id} (${file.filename}): ${count} transactions`);
    }

    // Transform to response format
    const uploads = files.map(file => {
      const uploadBatch = file.uploadBatch as any;
      return {
        batchId: file.uploadBatchId,
        batchUploadedAt: uploadBatch?.uploadedAt ? new Date(uploadBatch.uploadedAt).toISOString() : null,
        fileId: file.id,
        filename: file.filename,
        status: file.status,
        transactionsFound: transactionCounts.get(file.id) || 0,
      };
    });

    logger.info(`Returning ${uploads.length} uploads for card ${cardIdNum}`);

    return NextResponse.json({ uploads });
  } catch (error) {
    logger.error(error, 'Failed to fetch card uploads');
    return NextResponse.json(
      { error: 'Failed to fetch card uploads' },
      { status: 500 }
    );
  }
}
