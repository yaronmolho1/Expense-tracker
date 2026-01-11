import { db } from '@/lib/db';
import { transactions, businesses, cards, categories, subscriptions } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, like, or, desc, asc, sql, SQL } from 'drizzle-orm';

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  cardIds?: number[];
  categoryIds?: number[];
  businessIds?: number[];
  parentCategoryIds?: number[];
  childCategoryIds?: number[];
  transactionTypes?: string[];
  statuses?: string[];
  amountMin?: number;
  amountMax?: number;
  search?: string;
  uncategorized?: boolean;
  page?: number;
  perPage?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface TransactionListItem {
  id: number;
  business_id: number;
  business_name: string;
  deal_date: string;
  bank_charge_date: string | null;
  charged_amount_ils: number;
  original_amount: number | null;
  original_currency: string;
  category: {
    primary: string | null;
    child: string | null;
  };
  card: {
    last_4: string;
    nickname: string | null;
  };
  transaction_type: string;
  status: string;
  installment_info: {
    index: number;
    total: number;
    group_id: string;
  } | null;
  is_refund: boolean;
  subscription: {
    id: number;
    name: string | null;
  } | null;
}

export interface TransactionListResponse {
  total: number;
  page: number;
  per_page: number;
  transactions: TransactionListItem[];
}

export async function queryTransactions(
  filters: TransactionFilters
): Promise<TransactionListResponse> {
  const {
    dateFrom,
    dateTo,
    cardIds,
    categoryIds,
    businessIds,
    parentCategoryIds,
    childCategoryIds,
    transactionTypes,
    statuses,
    amountMin,
    amountMax,
    search,
    uncategorized,
    page = 1,
    perPage = 50,
    sortField = 'deal_date',
    sortDirection = 'desc',
  } = filters;

  // Build WHERE conditions
  const conditions: SQL[] = [];

  const paymentDateExpr = sql`COALESCE(${transactions.actualChargeDate}::date, ${transactions.projectedChargeDate}::date, ${transactions.bankChargeDate}::date, ${transactions.dealDate}::date)`;

  if (dateFrom) conditions.push(sql`${paymentDateExpr} >= ${dateFrom}::date`);
  if (dateTo) conditions.push(sql`${paymentDateExpr} <= ${dateTo}::date`);
  if (cardIds?.length) conditions.push(inArray(transactions.cardId, cardIds));
  if (transactionTypes?.length) {
    // Separate refund filter from transaction type filters
    const refundSelected = transactionTypes.includes('refund');
    const otherTypes = transactionTypes.filter(t => t !== 'refund');

    const typeConditions: SQL[] = [];

    // Add transaction type filter (one_time, installment, subscription)
    if (otherTypes.length > 0) {
      typeConditions.push(inArray(transactions.transactionType, otherTypes as any));
    }

    // Add refund filter (is_refund = true)
    if (refundSelected) {
      typeConditions.push(eq(transactions.isRefund, true));
    }

    // Combine with OR (refund OR type matches)
    if (typeConditions.length > 0) {
      conditions.push(or(...typeConditions)!);
    }
  }
  if (statuses?.length) {
    conditions.push(inArray(transactions.status, statuses as any));
  }

  if (amountMin !== undefined) conditions.push(gte(transactions.chargedAmountIls, amountMin.toString()));
  if (amountMax !== undefined) conditions.push(lte(transactions.chargedAmountIls, amountMax.toString()));

  // Business ID filter (array)
  if (businessIds?.length) {
    conditions.push(inArray(transactions.businessId, businessIds));
  }

  // Uncategorized filter (mutually exclusive with category filters)
  if (uncategorized) {
    conditions.push(sql`${businesses.primaryCategoryId} IS NULL`);
  } else {
    // Parent category filter (array)
    if (parentCategoryIds?.length) {
      conditions.push(inArray(businesses.primaryCategoryId, parentCategoryIds));
    }

    // Child category filter (array)
    if (childCategoryIds?.length) {
      conditions.push(inArray(businesses.childCategoryId, childCategoryIds));
    }

    // Legacy category filter (check both primary and child)
    if (categoryIds?.length) {
      conditions.push(
        or(
          inArray(businesses.primaryCategoryId, categoryIds),
          inArray(businesses.childCategoryId, categoryIds)
        )!
      );
    }
  }

  // Search filter (business name)
  if (search) {
    conditions.push(like(businesses.displayName, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build ORDER BY
  const orderByMap: Record<string, any> = {
    deal_date: transactions.dealDate,
    bank_charge_date: paymentDateExpr,
    charged_amount_ils: transactions.chargedAmountIls,
    business_name: businesses.displayName,
  };

  const orderByColumn = orderByMap[sortField] || paymentDateExpr;
  const orderBy = sortDirection === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

  // Count total (for pagination)
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .leftJoin(cards, eq(transactions.cardId, cards.id))
    .leftJoin(subscriptions, eq(transactions.subscriptionId, subscriptions.id))
    .where(whereClause);

  const total = Number(totalResult[0]?.count) || 0;

  // Fetch paginated data
  const offset = (page - 1) * perPage;

  const results = await db
    .select({
      id: transactions.id,
      dealDate: transactions.dealDate,
      bankChargeDate: transactions.bankChargeDate,
      actualChargeDate: transactions.actualChargeDate,
      projectedChargeDate: transactions.projectedChargeDate,
      chargedAmountIls: transactions.chargedAmountIls,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      transactionType: transactions.transactionType,
      status: transactions.status,
      isRefund: transactions.isRefund,
      installmentIndex: transactions.installmentIndex,
      installmentTotal: transactions.installmentTotal,
      installmentGroupId: transactions.installmentGroupId,
      businessId: businesses.id,
      businessName: businesses.displayName,
      primaryCategoryId: businesses.primaryCategoryId,
      childCategoryId: businesses.childCategoryId,
      cardId: cards.id,
      cardLast4: cards.last4Digits,
      cardNickname: cards.nickname,
      subscriptionId: subscriptions.id,
      subscriptionName: subscriptions.name,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .leftJoin(cards, eq(transactions.cardId, cards.id))
    .leftJoin(subscriptions, eq(transactions.subscriptionId, subscriptions.id))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(perPage)
    .offset(offset);

  // Fetch category names separately
  const categoryIdsToFetch = new Set<number>();
  results.forEach((r) => {
    if (r.primaryCategoryId) categoryIdsToFetch.add(r.primaryCategoryId);
    if (r.childCategoryId) categoryIdsToFetch.add(r.childCategoryId);
  });

  const categoryMap = new Map<number, string>();
  if (categoryIdsToFetch.size > 0) {
    const cats = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(inArray(categories.id, Array.from(categoryIdsToFetch)));

    cats.forEach((c) => categoryMap.set(c.id, c.name));
  }

  // Transform results
  const transformedResults: TransactionListItem[] = results.map((r) => ({
    id: r.id,
    business_id: r.businessId || 0,
    business_name: r.businessName || 'Unknown',
    deal_date: r.dealDate,
    bank_charge_date: r.actualChargeDate || r.projectedChargeDate || r.bankChargeDate || null,
    charged_amount_ils: Number(r.chargedAmountIls),
    original_amount: r.originalAmount ? Number(r.originalAmount) : null,
    original_currency: r.originalCurrency,
    category: {
      primary: r.primaryCategoryId ? categoryMap.get(r.primaryCategoryId) || null : null,
      child: r.childCategoryId ? categoryMap.get(r.childCategoryId) || null : null,
    },
    card: {
      last_4: r.cardLast4 || '',
      nickname: r.cardNickname || null,
    },
    transaction_type: r.transactionType,
    status: r.status,
    installment_info: r.installmentGroupId
      ? {
          index: r.installmentIndex!,
          total: r.installmentTotal!,
          group_id: r.installmentGroupId,
        }
      : null,
    is_refund: r.isRefund,
    subscription: r.subscriptionId
      ? {
          id: r.subscriptionId,
          name: r.subscriptionName || null,
        }
      : null,
  }));

  return {
    total,
    page,
    per_page: perPage,
    transactions: transformedResults,
  };
}
