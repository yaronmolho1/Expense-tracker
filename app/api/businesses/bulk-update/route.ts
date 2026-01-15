import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

const BulkUpdateSchema = z.object({
  business_ids: z.array(z.number().int().positive()).min(1, 'At least one business ID is required'),
  primary_category_id: z.number().int().positive(),
  child_category_id: z.number().int().positive().nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const validation = BulkUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { business_ids, primary_category_id, child_category_id } = validation.data;

    // Update all businesses in one query
    await db
      .update(businesses)
      .set({
        primaryCategoryId: primary_category_id,
        childCategoryId: child_category_id ?? null,
        categorizationSource: 'user',
        approved: true,
        updatedAt: new Date(),
      })
      .where(inArray(businesses.id, business_ids));

    return NextResponse.json({
      success: true,
      updated: business_ids.length,
    });
  } catch (error) {
    console.error('[API] Failed to bulk update businesses:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update businesses' },
      { status: 500 }
    );
  }
}
