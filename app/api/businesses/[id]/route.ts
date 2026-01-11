import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const UpdateBusinessSchema = z.object({
  approved: z.boolean().optional(),
  display_name: z.string().min(1).optional(),
  primary_category_id: z.number().int().nullable().optional(),
  child_category_id: z.number().int().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ requires awaiting params
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { error: 'Invalid business ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateBusinessSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const updates: any = {};

    if (validation.data.approved !== undefined) {
      updates.approved = validation.data.approved;
    }

    if (validation.data.display_name) {
      updates.displayName = validation.data.display_name;
    }

    if (validation.data.primary_category_id !== undefined) {
      updates.primaryCategoryId = validation.data.primary_category_id;
    }

    if (validation.data.child_category_id !== undefined) {
      updates.childCategoryId = validation.data.child_category_id;
    }

    // When updating categories, auto-approve the business
    if (validation.data.primary_category_id !== undefined || validation.data.child_category_id !== undefined) {
      updates.approved = true;
    }

    // Update business
    await db
      .update(businesses)
      .set(updates)
      .where(eq(businesses.id, businessId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to update business:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update business' },
      { status: 500 }
    );
  }
}
