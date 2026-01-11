import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses, transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { error: 'Invalid business ID' },
        { status: 400 }
      );
    }

    // Fetch the merged business
    const mergedBusiness = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId),
    });

    if (!mergedBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (!mergedBusiness.mergedToId) {
      return NextResponse.json(
        { error: 'Business is not merged' },
        { status: 400 }
      );
    }

    const targetId = mergedBusiness.mergedToId;

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Step 1: Move transactions back to the original business
      // Find all transactions where originalBusinessId matches this business
      await tx
        .update(transactions)
        .set({ businessId: businessId })
        .where(eq(transactions.originalBusinessId, businessId));

      // Step 2: Clear the mergedToId to restore the business
      await tx
        .update(businesses)
        .set({ mergedToId: null })
        .where(eq(businesses.id, businessId));
    });

    logger.info({
      businessId,
      targetId,
      businessName: mergedBusiness.displayName,
    }, 'Business unmerged');

    return NextResponse.json({
      success: true,
      message: `Business "${mergedBusiness.displayName}" has been unmerged`,
      business_id: businessId,
    });
  } catch (error) {
    logger.error(error, 'Failed to unmerge business');
    return NextResponse.json(
      { error: 'Failed to unmerge business' },
      { status: 500 }
    );
  }
}
