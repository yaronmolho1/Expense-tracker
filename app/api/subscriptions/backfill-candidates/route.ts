import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, businesses } from '@/lib/db/schema';
import { eq, and, gte, lte, isNull, sql } from 'drizzle-orm';

/**
 * GET /api/subscriptions/backfill-candidates
 *
 * Fetches past transactions that could be linked to a new subscription.
 * These are transactions from the same business/card between the start date and today
 * that aren't already part of a subscription.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const businessName = searchParams.get('businessName');
    const cardId = searchParams.get('cardId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if ((!businessId && !businessName) || !cardId || !startDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: (businessId OR businessName), cardId, startDate' },
        { status: 400 }
      );
    }

    // If businessName is provided, find the businessId
    let resolvedBusinessId: number;
    if (businessId) {
      resolvedBusinessId = parseInt(businessId);
    } else {
      const normalizedName = businessName!.toLowerCase().trim();
      const business = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.normalizedName, normalizedName))
        .limit(1);

      if (business.length === 0) {
        // Business doesn't exist yet, return empty list
        return NextResponse.json({
          transactions: [],
          count: 0,
        });
      }
      resolvedBusinessId = business[0].id;
    }

    // Fetch candidates: transactions from this business/card, not already in a subscription
    const candidates = await db
      .select({
        id: transactions.id,
        dealDate: transactions.dealDate,
        chargedAmountIls: transactions.chargedAmountIls,
        transactionHash: transactions.transactionHash,
        transactionType: transactions.transactionType,
        subscriptionId: transactions.subscriptionId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.businessId, resolvedBusinessId),
          eq(transactions.cardId, parseInt(cardId)),
          gte(transactions.dealDate, startDate),
          lte(transactions.dealDate, endDate),
          eq(transactions.status, 'completed'), // Only completed transactions
          isNull(transactions.subscriptionId), // Not already linked to a subscription
          eq(transactions.paymentType, 'one_time') // Exclude installments
        )
      )
      .orderBy(transactions.dealDate);

    return NextResponse.json({
      transactions: candidates,
      count: candidates.length,
    });
  } catch (error) {
    console.error('Error fetching backfill candidates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backfill candidates' },
      { status: 500 }
    );
  }
}
