import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, subscriptions } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, gt, sql } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  cardIds: z.array(z.number()).optional(),

  // Checkbox selections for transaction types
  includeOneTime: z.boolean().default(true),
  includeInstallments: z.boolean().default(true),
  includeSubscriptions: z.boolean().default(true),

  // Strategies for each type
  installmentStrategy: z.enum([
    'delete_all_matching_groups',
    'delete_matching_only',
    'skip_all'
  ]).optional(),

  subscriptionStrategy: z.enum([
    'skip',
    'delete_in_range_and_cancel'
  ]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { dateFrom, dateTo, cardIds, includeOneTime, includeInstallments, includeSubscriptions, installmentStrategy, subscriptionStrategy } = validation.data;

    // Build query conditions
    const conditions = [];

    if (dateFrom) {
      conditions.push(gte(transactions.dealDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(transactions.dealDate, dateTo));
    }
    if (cardIds && cardIds.length > 0) {
      conditions.push(inArray(transactions.cardId, cardIds));
    }

    // Query matching transactions
    const matchingTransactions = await db.query.transactions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        business: true,
      },
    });

    if (matchingTransactions.length === 0) {
      return NextResponse.json({
        requiresConfirmation: false,
        summary: {
          totalInRange: 0,
          oneTimeCount: 0,
          installmentCount: 0,
          subscriptionCount: 0,
        },
      });
    }

    // Analyze transaction types
    const oneTimeCount = matchingTransactions.filter(
      tx => !tx.installmentGroupId && tx.transactionType !== 'subscription'
    ).length;
    const installmentCount = matchingTransactions.filter(
      tx => tx.installmentGroupId
    ).length;
    const subscriptionCount = matchingTransactions.filter(
      tx => tx.transactionType === 'subscription'
    ).length;

    // Group transactions by installmentGroupId
    const installmentGroups = new Map<string, typeof matchingTransactions>();
    const oneTimeTransactions: typeof matchingTransactions = [];

    matchingTransactions.forEach(tx => {
      if (tx.installmentGroupId) {
        const group = installmentGroups.get(tx.installmentGroupId) || [];
        group.push(tx);
        installmentGroups.set(tx.installmentGroupId, group);
      } else {
        oneTimeTransactions.push(tx);
      }
    });

    // Analyze partial installment groups
    const partialInstallments = [];
    for (const [groupId, inRangeTxs] of installmentGroups.entries()) {
      // Fetch ALL transactions in this installment group
      const allInGroup = await db.query.transactions.findMany({
        where: eq(transactions.installmentGroupId, groupId),
        orderBy: (transactions, { asc }) => [asc(transactions.installmentIndex)],
      });

      // Check if this is a partial group
      if (allInGroup.length > inRangeTxs.length) {
        partialInstallments.push({
          groupId,
          businessName: (inRangeTxs[0]?.business as any)?.displayName || 'Unknown',
          inBatch: inRangeTxs.length,
          total: allInGroup.length,
          allPayments: allInGroup.map(tx => ({
            index: tx.installmentIndex || 0,
            dealDate: tx.dealDate,
            amount: parseFloat(tx.chargedAmountIls || '0'),
            status: tx.status as 'completed' | 'projected' | 'cancelled',
            inThisBatch: inRangeTxs.some(r => r.id === tx.id),
          })),
        });
      }
    }

    // Analyze subscriptions in range
    const subscriptionTransactions = matchingTransactions.filter(tx => tx.subscriptionId);
    const subscriptionIds = new Set(subscriptionTransactions.map(tx => tx.subscriptionId).filter(Boolean));

    const affectedSubscriptions = [];
    for (const subId of Array.from(subscriptionIds)) {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, subId as number),
        with: { business: true }
      });

      if (!sub) continue;

      const txsInRange = subscriptionTransactions.filter(tx => tx.subscriptionId === subId);

      // Get dates
      const dates = txsInRange.map(tx => new Date(tx.dealDate));
      const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));

      // Check if subscription continues after range
      const futureResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(and(
          eq(transactions.subscriptionId, subId as number),
          gt(transactions.dealDate, dateTo || '9999-12-31')
        ));

      affectedSubscriptions.push({
        id: subId,
        name: sub.name || (sub.business as any)?.displayName || 'Unknown',
        businessName: (sub.business as any)?.displayName || 'Unknown',
        transactionsInRange: txsInRange.length,
        earliestDate: earliestDate.toISOString(),
        latestDate: latestDate.toISOString(),
        continuesAfterRange: Number(futureResult[0]?.count || 0) > 0,
        frequency: sub.frequency,
        status: sub.status,
      });
    }

    // Stage 1: If no strategies specified, return preview
    if (!installmentStrategy || !subscriptionStrategy) {
      return NextResponse.json({
        requiresConfirmation: true,
        summary: {
          totalInRange: matchingTransactions.length,
          oneTimeCount,
          installmentCount,
          installmentGroupsCount: installmentGroups.size,
          subscriptionCount,
          subscriptionsAffected: affectedSubscriptions.length,
        },
        partialInstallments,
        affectedSubscriptions,
        oneTimeTransactions: oneTimeCount,
      });
    }

    // Stage 2: Execute deletion with strategies
    let deletedCount = 0;
    const affectedSubscriptionIds: number[] = [];

    // 1. One-time transactions
    if (includeOneTime) {
      for (const tx of oneTimeTransactions) {
        if (!tx.installmentGroupId && tx.transactionType !== 'subscription') {
          await db.delete(transactions).where(eq(transactions.id, tx.id));
          deletedCount++;
        }
      }
    }

    // 2. Installments
    if (includeInstallments && installmentStrategy && installmentStrategy !== 'skip_all') {
      if (installmentStrategy === 'delete_all_matching_groups') {
        // Delete ALL payments in groups that have ANY payment in range
        for (const groupId of installmentGroups.keys()) {
          const deleted = await db.delete(transactions)
            .where(eq(transactions.installmentGroupId, groupId))
            .returning();
          deletedCount += deleted.length;
        }
      } else if (installmentStrategy === 'delete_matching_only') {
        // Delete only payments in date range
        for (const [groupId, inRangeTxs] of installmentGroups.entries()) {
          for (const tx of inRangeTxs) {
            await db.delete(transactions).where(eq(transactions.id, tx.id));
            deletedCount++;
          }
        }
      }
    }

    // 3. Subscriptions
    if (includeSubscriptions && subscriptionStrategy === 'delete_in_range_and_cancel') {
      for (const subId of Array.from(subscriptionIds)) {
        const txsInRange = subscriptionTransactions.filter(tx => tx.subscriptionId === subId);
        const dates = txsInRange.map(tx => new Date(tx.dealDate));
        const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));

        // Cancel subscription (soft delete)
        await db.update(subscriptions)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            endDate: earliestDate.toISOString().split('T')[0],
          })
          .where(eq(subscriptions.id, subId as number));

        affectedSubscriptionIds.push(subId as number);

        // Delete transactions in range
        for (const tx of txsInRange) {
          await db.delete(transactions).where(eq(transactions.id, tx.id));
          deletedCount++;
        }
      }
    }

    logger.info({
      dateFrom,
      dateTo,
      cardIds,
      includeOneTime,
      includeInstallments,
      includeSubscriptions,
      installmentStrategy,
      subscriptionStrategy,
      deletedCount,
      cancelledSubscriptions: affectedSubscriptionIds.length,
    }, 'Bulk transaction deletion completed');

    return NextResponse.json({
      success: true,
      deletedTransactions: deletedCount,
      cancelledSubscriptions: affectedSubscriptionIds.length,
    });

  } catch (error) {
    logger.error(error, 'Failed to bulk delete transactions');
    return NextResponse.json(
      { error: 'Failed to bulk delete transactions' },
      { status: 500 }
    );
  }
}
