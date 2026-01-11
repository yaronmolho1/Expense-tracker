import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, businesses, businessMergeSuggestions } from '@/lib/db/schema';
import { eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';

const MergeBusinessesSchema = z.object({
  target_id: z.number().int().positive(),
  business_ids: z.array(z.number().int().positive()).min(2),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = MergeBusinessesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { target_id, business_ids } = validation.data;

    // Verify target_id is in the business_ids list
    if (!business_ids.includes(target_id)) {
      return NextResponse.json(
        { error: 'Target business must be one of the selected businesses' },
        { status: 400 }
      );
    }

    // Get all business IDs except the target
    const businessesToMerge = business_ids.filter(id => id !== target_id);

    if (businessesToMerge.length === 0) {
      return NextResponse.json(
        { error: 'No businesses to merge' },
        { status: 400 }
      );
    }

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Step 1: CRITICAL - Update all transactions from merged businesses to point to target
      // Also set originalBusinessId if not already set (to track where they came from)
      await tx
        .update(transactions)
        .set({
          businessId: target_id,
          originalBusinessId: sql`COALESCE(original_business_id, business_id)`, // Keep existing or set to current
        })
        .where(inArray(transactions.businessId, businessesToMerge));

      // Step 2: Delete any merge suggestions involving these businesses (cleanup)
      await tx
        .delete(businessMergeSuggestions)
        .where(
          or(
            inArray(businessMergeSuggestions.businessId1, businessesToMerge),
            inArray(businessMergeSuggestions.businessId2, businessesToMerge)
          )
        );

      // Step 3: Mark merged businesses with mergedToId instead of deleting them
      // This enses future transactions with these businesses auto-redirect to target
      await tx
        .update(businesses)
        .set({ mergedToId: target_id })
        .where(inArray(businesses.id, businessesToMerge));
    });

    logger.info({
      targetId: target_id,
      businessesMerged: businessesToMerge.length,
      businessIds: businessesToMerge,
    }, 'Businesses merged');

    return NextResponse.json({
      success: true,
      businesses_merged: businessesToMerge.length,
    });
  } catch (error) {
    logger.error(error, 'Failed to merge businesses');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to merge businesses' },
      { status: 500 }
    );
  }
}
