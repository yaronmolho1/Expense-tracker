import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptionSuggestions, subscriptions, businesses, transactions, uploadBatches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const suggestionId = parseInt(id);
    const body = await request.json();

    const { adjustedAmount, startDate, endDate, skipTransactionCreation } = body;

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

    if (suggestion.status !== 'pending') {
      return NextResponse.json(
        { error: 'Suggestion already resolved' },
        { status: 400 }
      );
    }

    // If skipTransactionCreation is true, just mark as approved without creating anything
    if (skipTransactionCreation) {
      await db
        .update(subscriptionSuggestions)
        .set({
          status: 'approved',
          resolvedAt: new Date(),
        })
        .where(eq(subscriptionSuggestions.id, suggestionId));

      return NextResponse.json({
        message: 'Suggestion marked as approved',
      });
    }

    // Look up or create business
    const normalizedName = suggestion.businessName.toLowerCase().trim();
    let business = await db
      .select()
      .from(businesses)
      .where(eq(businesses.normalizedName, normalizedName))
      .limit(1);

    let businessId: number;
    if (business.length === 0) {
      // Create new business
      const [newBusiness] = await db
        .insert(businesses)
        .values({
          normalizedName,
          displayName: suggestion.businessName,
          approved: false,
        })
        .returning();
      businessId = newBusiness.id;
    } else {
      businessId = business[0].id;
    }

    // Create subscription
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        businessId,
        cardId: suggestion.cardId,
        amount: (adjustedAmount || suggestion.detectedAmount).toString(),
        frequency: suggestion.frequency,
        startDate: startDate || suggestion.firstOccurrence,
        endDate: endDate || null,
        status: 'active',
        createdFromSuggestion: true,
      })
      .returning();

    // Mark suggestion as approved
    await db
      .update(subscriptionSuggestions)
      .set({
        status: 'approved',
        resolvedAt: new Date(),
      })
      .where(eq(subscriptionSuggestions.id, suggestionId));

    // Get or create upload batch for manual subscriptions
    let manualBatch = await db.query.uploadBatches.findFirst({
      where: eq(uploadBatches.status, 'completed'),
      orderBy: (batches, { desc }) => [desc(batches.id)],
    });

    if (!manualBatch) {
      const [batch] = await db
        .insert(uploadBatches)
        .values({
          status: 'completed',
          fileCount: 0,
          totalTransactions: 0,
        })
        .returning();
      manualBatch = batch;
    }

    // Generate transactions (backfilled + projected)
    const start = new Date(startDate || suggestion.firstOccurrence);
    const now = new Date();
    const effectiveEndDate = endDate
      ? new Date(endDate)
      : new Date(start.getFullYear() + 3, start.getMonth(), start.getDate());

    const monthsToAdd = suggestion.frequency === 'monthly' ? 1 : 12;
    let currentDate = new Date(start);
    const transactionsToCreate = [];
    let projectedCount = 0;

    while (currentDate <= effectiveEndDate) {
      const isInPast = currentDate < now;
      const transactionStatus: 'completed' | 'projected' = isInPast ? 'completed' : 'projected';

      // Format date as YYYY-MM-DD
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      // Generate unique transaction hash
      const hashInput = `sub-${newSubscription.id}-${formattedDate}-${businessId}-${suggestion.cardId}`;
      const transactionHash = createHash('sha256').update(hashInput).digest('hex');

      // Use detected amount (or adjusted amount from body)
      const amount = adjustedAmount || suggestion.detectedAmount;

      transactionsToCreate.push({
        transactionHash,
        businessId,
        cardId: suggestion.cardId,
        transactionType: 'subscription' as const,
        dealDate: formattedDate,
        bankChargeDate: formattedDate,
        originalAmount: amount.toString(),
        originalCurrency: 'ILS', // Suggestions detect in ILS
        exchangeRateUsed: '1.000000',
        chargedAmountIls: amount.toString(),
        paymentType: 'one_time' as const,
        subscriptionId: newSubscription.id,
        status: transactionStatus,
        projectedChargeDate: isInPast ? null : formattedDate,
        actualChargeDate: isInPast ? formattedDate : null,
        isRefund: false,
        sourceFile: 'manual-subscription-suggestion',
        uploadBatchId: manualBatch.id,
      });

      if (!isInPast) {
        projectedCount++;
      }

      currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
    }

    // Insert all transactions in bulk
    if (transactionsToCreate.length > 0) {
      await db.insert(transactions).values(transactionsToCreate);
    }

    const backfilledCount = transactionsToCreate.length - projectedCount;

    return NextResponse.json({
      subscription: newSubscription,
      projectedCount,
      backfilledCount,
      message: 'Subscription created from suggestion',
    });
  } catch (error) {
    console.error('Error approving subscription suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to approve suggestion' },
      { status: 500 }
    );
  }
}
