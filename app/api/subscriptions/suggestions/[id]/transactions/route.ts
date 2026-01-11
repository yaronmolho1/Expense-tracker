import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptionSuggestions, transactions, businesses } from '@/lib/db/schema';
import { eq, and, gte, lte, isNull, between, sql } from 'drizzle-orm';

/**
 * GET /api/subscriptions/suggestions/[id]/transactions
 *
 * Gets the specific transactions that match a subscription suggestion.
 * Returns transaction IDs that were used to detect this subscription pattern.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const suggestionId = parseInt(id);

    // Get the suggestion
    const [suggestion] = await db
      .select()
      .from(subscriptionSuggestions)
      .where(eq(subscriptionSuggestions.id, suggestionId));

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    // Find the business
    const normalizedName = suggestion.businessName.toLowerCase().trim();
    const business = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.normalizedName, normalizedName))
      .limit(1);

    if (business.length === 0) {
      return NextResponse.json({
        transactionIds: [],
      });
    }

    const businessId = business[0].id;

    // Query for transactions matching the suggestion criteria
    // - Same business and card
    // - Between first and last occurrence dates
    // - Amount matches detected amount (with 5% tolerance for currency fluctuations)
    const detectedAmount = parseFloat(suggestion.detectedAmount);
    const minAmount = detectedAmount * 0.95;
    const maxAmount = detectedAmount * 1.05;

    const matchingTransactions = await db
      .select({
        id: transactions.id,
        dealDate: transactions.dealDate,
        chargedAmountIls: transactions.chargedAmountIls,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.businessId, businessId),
          eq(transactions.cardId, suggestion.cardId),
          gte(transactions.dealDate, suggestion.firstOccurrence),
          lte(transactions.dealDate, suggestion.lastOccurrence),
          eq(transactions.status, 'completed'),
          isNull(transactions.subscriptionId),
          eq(transactions.paymentType, 'one_time'),
          sql`${transactions.chargedAmountIls}::numeric BETWEEN ${minAmount} AND ${maxAmount}`
        )
      )
      .orderBy(transactions.dealDate);

    return NextResponse.json({
      transactionIds: matchingTransactions.map(t => t.id),
      transactions: matchingTransactions,
    });
  } catch (error) {
    console.error('Error fetching suggestion transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestion transactions' },
      { status: 500 }
    );
  }
}
