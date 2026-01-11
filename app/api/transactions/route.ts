import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryTransactions } from '@/lib/services/transaction-service';
import { db } from '@/lib/db';
import { transactions, businesses, uploadBatches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import logger from '@/lib/logger';

// Zod validation schemas
const transactionQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  card_ids: z.string().optional(),
  category_ids: z.string().optional(),
  business_ids: z.string().optional(),
  parent_category_ids: z.string().optional(),
  child_category_ids: z.string().optional(),
  transaction_types: z.string().optional(),
  statuses: z.string().optional(),
  amount_min: z.coerce.number().positive().optional(),
  amount_max: z.coerce.number().positive().optional(),
  search: z.string().optional(),
  uncategorized: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().regex(/^(deal_date|bank_charge_date|charged_amount_ils|business_name):(asc|desc)$/).default('bank_charge_date:desc'),
});

const createTransactionSchema = z.object({
  businessId: z.number().int().positive().optional(),
  businessName: z.string().min(1).optional(),
  cardId: z.number().int().positive(),
  dealDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  currency: z.enum(['ILS', 'USD', 'EUR']),
  paymentType: z.enum(['one_time', 'installments']).optional(),
  installmentIndex: z.number().int().positive().optional(),
  installmentTotal: z.number().int().positive().min(2).optional(),
  installmentAmount: z.number().positive().optional(),
  primaryCategoryId: z.number().int().positive().optional(),
  childCategoryId: z.number().int().positive().optional(),
  notes: z.string().optional(),
}).refine((data) => data.businessId || data.businessName, {
  message: 'Either businessId or businessName must be provided',
  path: ['businessId', 'businessName'],
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Convert searchParams to object
    const params = Object.fromEntries(searchParams.entries());

    // Validate with Zod
    const validated = transactionQuerySchema.safeParse(params);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validated.error.issues
        },
        { status: 400 }
      );
    }

    const {
      date_from,
      date_to,
      card_ids,
      category_ids,
      business_ids,
      parent_category_ids,
      child_category_ids,
      transaction_types,
      statuses,
      amount_min,
      amount_max,
      search,
      uncategorized,
      page,
      per_page,
      sort,
    } = validated.data;

    // Parse sort parameter
    const [sortField, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];

    // Parse comma-separated IDs
    const cardIdsArray = card_ids?.split(',').map(Number).filter(Boolean);
    const categoryIdsArray = category_ids?.split(',').map(Number).filter(Boolean);
    const businessIdsArray = business_ids?.split(',').map(Number).filter(Boolean);
    const parentCategoryIdsArray = parent_category_ids?.split(',').map(Number).filter(Boolean);
    const childCategoryIdsArray = child_category_ids?.split(',').map(Number).filter(Boolean);
    const transactionTypesArray = transaction_types?.split(',');
    const statusesArray = statuses?.split(',');

    // Call service layer
    const result = await queryTransactions({
      dateFrom: date_from,
      dateTo: date_to,
      cardIds: cardIdsArray,
      categoryIds: categoryIdsArray,
      businessIds: businessIdsArray,
      parentCategoryIds: parentCategoryIdsArray,
      childCategoryIds: childCategoryIdsArray,
      transactionTypes: transactionTypesArray,
      statuses: statusesArray,
      amountMin: amount_min,
      amountMax: amount_max,
      search,
      uncategorized: uncategorized === 'true',
      page,
      perPage: per_page,
      sortField,
      sortDirection,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(error, 'Failed to fetch transactions');
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createTransactionSchema.safeParse(body);

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
      businessId,
      businessName,
      cardId,
      dealDate,
      amount,
      currency,
      paymentType, // 'one_time' or 'installments'
      installmentIndex,
      installmentTotal,
      installmentAmount,
      primaryCategoryId,
      childCategoryId,
      notes,
    } = validated.data;

    // Handle business creation/lookup
    let finalBusinessId: number;
    if (!businessId && businessName) {
      const normalizedName = businessName.toLowerCase().trim();

      const existingBusiness = await db
        .select()
        .from(businesses)
        .where(eq(businesses.normalizedName, normalizedName))
        .limit(1);

      if (existingBusiness.length > 0) {
        finalBusinessId = existingBusiness[0].id;
      } else {
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
      
      // Update categories if provided
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

    // Convert amount to ILS if needed
    let amountInILS = amount;
    let exchangeRate = '1.000000';
    if (currency === 'USD') {
      amountInILS = amount * 3.6;
      exchangeRate = '3.600000';
    } else if (currency === 'EUR') {
      amountInILS = amount * 4.0;
      exchangeRate = '4.000000';
    }

    // Get or create manual transactions batch
    let manualBatch = await db.query.uploadBatches.findFirst({
      where: eq(uploadBatches.status, 'completed'),
      orderBy: (uploadBatches, { asc }) => [asc(uploadBatches.id)],
    });

    if (!manualBatch) {
      const [batch] = await db
        .insert(uploadBatches)
        .values({
          fileCount: 0,
          status: 'completed' as const,
          totalTransactions: 0,
          newTransactions: 0,
          updatedTransactions: 0,
        })
        .returning();
      manualBatch = batch;
    }

    // Handle installments vs one-time transactions
    if (paymentType === 'installments' && installmentTotal && installmentTotal > 1) {
      // Generate installment group ID
      const groupHashInput = `manual-installment-group-${finalBusinessId}-${dealDate}-${amountInILS}-${cardId}-${Date.now()}`;
      const installmentGroupId = createHash('sha256').update(groupHashInput).digest('hex');

      // Calculate amount per payment
      const perPaymentAmount = amountInILS / installmentTotal;
      const perPaymentOriginalAmount = amount / installmentTotal;

      // Generate all installment transactions
      const installmentTransactions = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for comparison

      for (let i = 1; i <= installmentTotal; i++) {
        // Calculate deal date for this payment (30 days apart)
        const paymentDate = new Date(dealDate);
        paymentDate.setDate(paymentDate.getDate() + (i - 1) * 30);
        const paymentDateString = paymentDate.toISOString().split('T')[0];

        // Determine if this is a future payment
        const isFuture = paymentDate > today;

        const hashInput = `manual-${finalBusinessId}-${paymentDateString}-${perPaymentAmount}-${cardId}-${i}`;
        const transactionHash = createHash('sha256').update(hashInput).digest('hex');

        installmentTransactions.push({
          transactionHash,
          businessId: finalBusinessId,
          cardId,
          transactionType: 'installment' as const,
          dealDate: paymentDateString,
          bankChargeDate: paymentDateString,
          originalAmount: perPaymentOriginalAmount.toFixed(2),
          originalCurrency: currency,
          exchangeRateUsed: exchangeRate,
          chargedAmountIls: perPaymentAmount.toFixed(2),
          paymentType: 'installments' as const,
          installmentIndex: i,
          installmentTotal: installmentTotal,
          installmentAmount: perPaymentAmount.toFixed(2),
          installmentGroupId,
          status: (isFuture ? 'projected' : 'completed') as 'projected' | 'completed',
          actualChargeDate: isFuture ? null : paymentDateString,
          isRefund: false,
          sourceFile: 'manual-entry',
          uploadBatchId: manualBatch.id,
        });
      }

      // Insert all installments
      await db.insert(transactions).values(installmentTransactions);

      return NextResponse.json(
        {
          message: `Successfully created ${installmentTotal} installment transactions`,
          count: installmentTotal,
        },
        { status: 201 }
      );
    } else {
      // One-time transaction
      const hashInput = `manual-${finalBusinessId}-${dealDate}-${amountInILS}-${cardId}-0`;
      const transactionHash = createHash('sha256').update(hashInput).digest('hex');

      const [newTransaction] = await db
        .insert(transactions)
        .values({
          transactionHash,
          businessId: finalBusinessId,
          cardId,
          transactionType: 'one_time' as const,
          dealDate,
          bankChargeDate: dealDate,
          originalAmount: amount.toString(),
          originalCurrency: currency,
          exchangeRateUsed: exchangeRate,
          chargedAmountIls: amountInILS.toString(),
          paymentType: 'one_time' as const,
          installmentIndex: null,
          installmentTotal: null,
          installmentAmount: null,
          installmentGroupId: null,
          status: 'completed' as const,
          actualChargeDate: dealDate,
          isRefund: false,
          sourceFile: 'manual-entry',
          uploadBatchId: manualBatch.id,
        })
        .returning();

      return NextResponse.json(
        {
          transaction: newTransaction,
          message: 'Transaction created successfully',
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Error creating transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create transaction';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
