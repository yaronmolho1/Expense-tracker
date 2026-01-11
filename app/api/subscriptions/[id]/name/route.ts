import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';

// Validation schema for subscription name update
const updateNameSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').nullable(),
});

// ============================================
// PATCH /api/subscriptions/[id]/name
// Update subscription name
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subscriptionId = parseInt(id);

    if (isNaN(subscriptionId)) {
      return NextResponse.json({ error: 'Invalid subscription ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateNameSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validated.error.issues
        },
        { status: 400 }
      );
    }

    const { name } = validated.data;

    // Update subscription name
    await db
      .update(subscriptions)
      .set({ name: name || null })
      .where(eq(subscriptions.id, subscriptionId));

    return NextResponse.json({ success: true, message: 'Subscription name updated' });
  } catch (error) {
    logger.error(error, 'Failed to update subscription name');
    return NextResponse.json(
      { error: 'Failed to update subscription name' },
      { status: 500 }
    );
  }
}
