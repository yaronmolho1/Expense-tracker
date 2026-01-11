import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptionSuggestions, cards } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'pending', 'approved', 'rejected', 'ignored', or null (all)

    // Build the base query
    const baseQuery = db
      .select({
        id: subscriptionSuggestions.id,
        businessName: subscriptionSuggestions.businessName,
        cardId: subscriptionSuggestions.cardId,
        cardLast4: cards.last4Digits,
        cardNickname: cards.nickname,
        detectedAmount: subscriptionSuggestions.detectedAmount,
        frequency: subscriptionSuggestions.frequency,
        firstOccurrence: subscriptionSuggestions.firstOccurrence,
        lastOccurrence: subscriptionSuggestions.lastOccurrence,
        occurrenceCount: subscriptionSuggestions.occurrenceCount,
        detectionReason: subscriptionSuggestions.detectionReason,
        status: subscriptionSuggestions.status,
        createdAt: subscriptionSuggestions.createdAt,
        resolvedAt: subscriptionSuggestions.resolvedAt,
      })
      .from(subscriptionSuggestions)
      .innerJoin(cards, eq(subscriptionSuggestions.cardId, cards.id))
      .$dynamic();

    // Apply status filter if provided
    const query = statusFilter
      ? baseQuery.where(eq(subscriptionSuggestions.status, statusFilter as any))
      : baseQuery;

    const results = await query.orderBy(desc(subscriptionSuggestions.createdAt));

    return NextResponse.json({ suggestions: results });
  } catch (error) {
    console.error('Error fetching subscription suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription suggestions' },
      { status: 500 }
    );
  }
}
