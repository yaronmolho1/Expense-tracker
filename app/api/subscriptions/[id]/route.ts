import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, transactions } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';

// Validation schema for subscription updates
const updateSubscriptionSchema = z.object({
  status: z.enum(['active', 'cancelled', 'ended']).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subscriptionId = parseInt(id);

    if (isNaN(subscriptionId)) {
      return NextResponse.json(
        { error: 'Invalid subscription ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateSubscriptionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validated.error.issues
        },
        { status: 400 }
      );
    }

    const { status, endDate, amount, notes } = validated.data;

    // Build update object
    const updateData: any = {};
    if (status) updateData.status = status;
    if (endDate !== undefined) updateData.endDate = endDate || null;
    if (amount !== undefined) updateData.amount = amount.toString();
    if (notes !== undefined) updateData.notes = notes;

    // If cancelling, set cancelledAt and endDate
    if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
      if (!updateData.endDate) {
        updateData.endDate = sql`CURRENT_DATE`;
      }
    }

    // Update subscription
    const [updated] = await db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscriptionId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // If cancelled, cancel future projected transactions
    if (status === 'cancelled') {
      await db
        .update(transactions)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(transactions.subscriptionId, subscriptionId),
            eq(transactions.status, 'projected'),
            gte(transactions.projectedChargeDate, sql`CURRENT_DATE`)
          )
        );
    }

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    logger.error(error, 'Failed to update subscription');
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// Validation schema for subscription deletion
const deleteSubscriptionSchema = z.object({
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD required)'),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subscriptionId = parseInt(id);

    if (isNaN(subscriptionId)) {
      return NextResponse.json(
        { error: 'Invalid subscription ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = deleteSubscriptionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validated.error.issues
        },
        { status: 400 }
      );
    }

    const { effectiveDate } = validated.data;

    if (!effectiveDate) {
      return NextResponse.json(
        { error: 'effectiveDate is required' },
        { status: 400 }
      );
    }

    // Cancel subscription and set end date to effective date
    const [cancelled] = await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        endDate: effectiveDate,
      })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const selectedDate = new Date(effectiveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    let deletedCount = 0;

    if (selectedDate > today) {
      // Future date: Delete projected transactions AFTER the effective date
      const result = await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.subscriptionId, subscriptionId),
            eq(transactions.status, 'projected'),
            gte(transactions.projectedChargeDate, effectiveDate)
          )
        )
        .returning();
      deletedCount = result.length;
    } else {
      // Past or today: Delete all transactions FROM the effective date onwards
      const result = await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.subscriptionId, subscriptionId),
            gte(transactions.dealDate, effectiveDate)
          )
        )
        .returning();
      deletedCount = result.length;
    }

    return NextResponse.json({
      message: 'Subscription cancelled successfully',
      deletedTransactions: deletedCount,
      effectiveDate,
    }, { status: 200 });
  } catch (error) {
    logger.error(error, 'Failed to delete subscription');
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
