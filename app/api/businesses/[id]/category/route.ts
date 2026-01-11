import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { businesses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';

const updateCategorySchema = z.object({
  primary_category_id: z.number().int().positive(),
  child_category_id: z.number().int().positive().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id);

    const body = await request.json();
    const validated = updateCategorySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validated.error.issues
        },
        { status: 400 }
      );
    }

    const { primary_category_id, child_category_id } = validated.data;

    // Update the business category
    await db
      .update(businesses)
      .set({
        primaryCategoryId: primary_category_id,
        childCategoryId: child_category_id,
      })
      .where(eq(businesses.id, businessId));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error, 'Failed to update business category');
    return NextResponse.json(
      { error: 'Failed to update business category' },
      { status: 500 }
    );
  }
}
