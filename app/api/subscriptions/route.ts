import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { subscriptions, businesses, cards, transactions, uploadBatches } from '@/lib/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';
import logger from '@/lib/logger';

// Zod validation schema
const createSubscriptionSchema = z.object({
  name: z.string().optional(),
  businessId: z.number().int().positive().nullable().optional(),
  businessName: z.string().min(1).optional(),
  cardId: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.enum(['ILS', 'USD', 'EUR']).optional(),
  frequency: z.enum(['monthly', 'annual']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  primaryCategoryId: z.number().int().positive().nullable().optional(),
  childCategoryId: z.number().int().positive().nullable().optional(),
  notes: z.string().optional(),
  backfillTransactionIds: z.array(z.number().int().positive()).optional(),
}).refine((data) => data.businessId || data.businessName, {
  message: 'Either businessId or businessName must be provided',
  path: ['businessId', 'businessName'],
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active', 'cancelled', 'ended', or null (all)

    // Build the base query
    const baseQuery = db
      .select({
        id: subscriptions.id,
        name: subscriptions.name,
        businessName: businesses.displayName,
        businessId: subscriptions.businessId,
        cardLast4: cards.last4Digits,
        cardNickname: cards.nickname,
        cardId: subscriptions.cardId,
        amount: subscriptions.amount,
        frequency: subscriptions.frequency,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        status: subscriptions.status,
        createdFromSuggestion: subscriptions.createdFromSuggestion,
        createdAt: subscriptions.createdAt,
        cancelledAt: subscriptions.cancelledAt,
        notes: subscriptions.notes,
      })
      .from(subscriptions)
      .innerJoin(businesses, eq(subscriptions.businessId, businesses.id))
      .innerJoin(cards, eq(subscriptions.cardId, cards.id))
      .$dynamic();

    // Apply status filter if provided
    const query = statusFilter
      ? baseQuery.where(eq(subscriptions.status, statusFilter as any))
      : baseQuery;

    const results = await query.orderBy(desc(subscriptions.createdAt));

    return NextResponse.json({ subscriptions: results });
  } catch (error) {
    logger.error(error, 'Failed to fetch subscriptions');
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createSubscriptionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validated.error.issues
        },
        { status: 400 }
      );
    }

    const {
      name,
      businessId,
      businessName,
      cardId,
      amount,
      currency,
      frequency,
      startDate,
      endDate,
      primaryCategoryId,
      childCategoryId,
      notes,
      backfillTransactionIds,
    } = validated.data;

    // Handle business creation if businessName is provided
    let finalBusinessId: number;
    if (!businessId && businessName) {
      const normalizedName = businessName.toLowerCase().trim();

      // Check if business already exists
      const existingBusiness = await db
        .select()
        .from(businesses)
        .where(eq(businesses.normalizedName, normalizedName))
        .limit(1);

      if (existingBusiness.length > 0) {
        finalBusinessId = existingBusiness[0].id;
      } else {
        // Create new business
        const [newBusiness] = await db
          .insert(businesses)
          .values({
            normalizedName,
            displayName: businessName,
            approved: false,
            primaryCategoryId: primaryCategoryId || null,
            childCategoryId: childCategoryId || null,
            categorizationSource: primaryCategoryId ? 'user' : null,
          })
          .returning();
        finalBusinessId = newBusiness.id;
      }
    } else if (businessId) {
      finalBusinessId = businessId;
      
      // Update existing business categories if provided
      if (primaryCategoryId || childCategoryId) {
        await db
          .update(businesses)
          .set({
            primaryCategoryId: primaryCategoryId || null,
            childCategoryId: childCategoryId || null,
            categorizationSource: primaryCategoryId ? 'user' : null,
          })
          .where(eq(businesses.id, businessId));
      }
    } else {
      // This should never happen due to Zod validation
      return NextResponse.json(
        { error: 'Either businessId or businessName must be provided' },
        { status: 400 }
      );
    }

    // Convert amount to ILS if needed (simplified - in production use real exchange rates)
    const effectiveCurrency = currency || 'ILS';
    let amountInILS = amount;
    if (effectiveCurrency === 'USD') {
      amountInILS = amount * 3.6; // Rough conversion
    } else if (effectiveCurrency === 'EUR') {
      amountInILS = amount * 4.0; // Rough conversion
    }

    // Get or create manual subscription batch
    let manualBatch = await db.query.uploadBatches.findFirst({
      where: eq(uploadBatches.status, 'completed'),
      orderBy: (uploadBatches, { asc }) => [asc(uploadBatches.id)],
    });

    if (!manualBatch) {
      // Create a special batch for manual subscriptions
      const [batch] = await db
        .insert(uploadBatches)
        .values({
          fileCount: 0,
          status: 'completed',
          totalTransactions: 0,
          newTransactions: 0,
          updatedTransactions: 0,
        })
        .returning();
      manualBatch = batch;
    }

    // Create subscription
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        businessId: finalBusinessId,
        cardId,
        amount: amountInILS.toString(),
        frequency,
        startDate,
        endDate: endDate || null,
        status: 'active',
        createdFromSuggestion: false,
        name: name || null,
        notes: notes || null,
      })
      .returning();

    // Link selected past transactions to this subscription FIRST
    let linkedCount = 0;
    let backfilledDates = new Set<string>();
    if (backfillTransactionIds && Array.isArray(backfillTransactionIds) && backfillTransactionIds.length > 0) {
      // Update the backfilled transactions
      await db
        .update(transactions)
        .set({
          subscriptionId: newSubscription.id,
          transactionType: 'subscription' as const,
        })
        .where(inArray(transactions.id, backfillTransactionIds));

      // Get the dates of backfilled transactions to avoid duplicates
      const backfilledTransactions = await db
        .select({ dealDate: transactions.dealDate })
        .from(transactions)
        .where(inArray(transactions.id, backfillTransactionIds));

      backfilledDates = new Set(backfilledTransactions.map(t => t.dealDate));
      linkedCount = backfillTransactionIds.length;
    }

    // Generate projected transactions (skip dates that have backfilled transactions)
    const start = new Date(startDate);
    const now = new Date();

    // If no end date, default to 3 years from start
    const effectiveEndDate = endDate
      ? new Date(endDate)
      : new Date(start.getFullYear() + 3, start.getMonth(), start.getDate());

    const monthsToAdd = frequency === 'monthly' ? 1 : 12;
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

      // Skip if this date already has a backfilled transaction
      if (!backfilledDates.has(formattedDate)) {
        // Generate unique transaction hash
        const hashInput = `sub-${newSubscription.id}-${formattedDate}-${finalBusinessId}-${cardId}`;
        const transactionHash = createHash('sha256').update(hashInput).digest('hex');

        transactionsToCreate.push({
          transactionHash,
          businessId: finalBusinessId,
          cardId,
          transactionType: 'subscription' as const,
          dealDate: formattedDate,
          bankChargeDate: formattedDate,
          originalAmount: amount.toString(),
          originalCurrency: effectiveCurrency,
          exchangeRateUsed: effectiveCurrency === 'ILS' ? '1.000000' : (effectiveCurrency === 'USD' ? '3.600000' : '4.000000'),
          chargedAmountIls: amountInILS.toString(),
          paymentType: 'one_time' as const,
          subscriptionId: newSubscription.id,
          status: transactionStatus,
          projectedChargeDate: isInPast ? null : formattedDate,
          actualChargeDate: isInPast ? formattedDate : null,
          isRefund: false,
          sourceFile: 'manual-subscription',
          uploadBatchId: manualBatch.id,
        });

        if (!isInPast) {
          projectedCount++;
        }
      }

      currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
    }

    // Insert all transactions in bulk
    if (transactionsToCreate.length > 0) {
      await db.insert(transactions).values(transactionsToCreate);
    }

    return NextResponse.json(
      {
        subscription: newSubscription,
        projectedCount,
        backfilledCount: transactionsToCreate.length - projectedCount,
        linkedCount,
        message: 'Subscription created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create subscription';
    return NextResponse.json({ error: errorMessage, details: error }, { status: 500 });
  }
}
