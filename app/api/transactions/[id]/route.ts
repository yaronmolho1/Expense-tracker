import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const UpdateTransactionSchema = z.object({
  status: z.enum(['completed', 'projected', 'cancelled']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = UpdateTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    // Check if transaction exists
    const existing = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updates.status = status;
    }

    // Update the transaction
    await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, transactionId));

    return NextResponse.json({
      success: true,
      message: 'Transaction updated successfully',
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Check for deleteAll parameter
    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get('deleteAll') === 'true';

    // Check if transaction exists
    const existing = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    let deletedCount = 0;

    // Handle installment deletion
    if (existing.installmentGroupId && deleteAll) {
      // Count transactions in the installment group
      const groupTransactions = await db.query.transactions.findMany({
        where: eq(transactions.installmentGroupId, existing.installmentGroupId),
      });
      deletedCount = groupTransactions.length;

      // Delete all transactions in the installment group
      await db.execute(sql`
        DELETE FROM transactions
        WHERE installment_group_id = ${existing.installmentGroupId}
      `);
    }
    // Handle subscription deletion
    else if (existing.subscriptionId && deleteAll) {
      // Count transactions in the subscription
      const subTransactions = await db.query.transactions.findMany({
        where: eq(transactions.subscriptionId, existing.subscriptionId),
      });
      deletedCount = subTransactions.length;

      // Delete all transactions in the subscription
      await db.execute(sql`
        DELETE FROM transactions
        WHERE subscription_id = ${existing.subscriptionId}
      `);
    }
    // Delete single transaction
    else {
      await db.delete(transactions).where(eq(transactions.id, transactionId));
      deletedCount = 1;
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: deletedCount > 1
        ? `${deletedCount} related transactions deleted`
        : 'Transaction deleted'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
