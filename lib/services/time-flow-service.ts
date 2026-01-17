import { db } from '@/lib/db';
import { transactions, businesses, cards, categories } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, sql, SQL, isNull, or } from 'drizzle-orm';
import { getBudgetsForMonth } from './category-service';

export interface TimeFlowFilters {
  monthsBack?: number;
  monthsForward?: number;
  cardIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  parentCategoryIds?: number[];
  childCategoryIds?: number[];
  uncategorized?: boolean;
}

export interface SubCategoryData {
  subCategoryId: number | null;
  subCategoryName: string | null;
  monthlyExpenses: Record<string, number>;
  monthlyBudgets: Record<string, number>;
  budgetPeriod: 'monthly' | 'annual' | null;
  annualBudgetAmount: number | null;
  yearToDateTotal: Record<string, number>; // keyed by year (e.g., "2025")
  rowTotal: number;
}

export interface MainCategoryData {
  mainCategoryId: number;
  mainCategoryName: string;
  subCategories: SubCategoryData[];
  categoryTotal: number;
}

export interface TimeFlowResponse {
  months: string[];
  categories: MainCategoryData[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

export async function queryTimeFlow(
  filters: TimeFlowFilters
): Promise<TimeFlowResponse> {
  const {
    monthsBack = 6,
    monthsForward = 6,
    cardIds,
    dateFrom,
    dateTo,
    parentCategoryIds,
    childCategoryIds,
    uncategorized,
  } = filters;

  // Generate month range
  const months: string[] = [];
  const today = new Date();

  for (let i = -monthsBack; i <= monthsForward; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push(yearMonth);
  }

  // Build WHERE conditions - use payment date (actual or projected)
  const conditions: SQL[] = [];

  const paymentDateExpr = sql<string>`COALESCE(${transactions.actualChargeDate}::text, ${transactions.projectedChargeDate}::text, ${transactions.bankChargeDate}::text, ${transactions.dealDate}::text)`;

  if (dateFrom) conditions.push(sql`${paymentDateExpr} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${paymentDateExpr} <= ${dateTo}`);
  if (cardIds?.length) conditions.push(inArray(transactions.cardId, cardIds));

  // Category filtering
  if (uncategorized) {
    conditions.push(isNull(businesses.primaryCategoryId));
  } else {
    if (parentCategoryIds?.length) {
      conditions.push(inArray(businesses.primaryCategoryId, parentCategoryIds));
    }
    if (childCategoryIds?.length) {
      conditions.push(inArray(businesses.childCategoryId, childCategoryIds));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query all transactions with category info and payment date
  const results = await db
    .select({
      paymentDate: paymentDateExpr,
      chargedAmountIls: transactions.chargedAmountIls,
      isRefund: transactions.isRefund,
      businessId: businesses.id,
      primaryCategoryId: businesses.primaryCategoryId,
      childCategoryId: businesses.childCategoryId,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .where(whereClause);

  // Get all unique category IDs
  const categoryIdsSet = new Set<number>();
  results.forEach((r) => {
    if (r.primaryCategoryId) categoryIdsSet.add(r.primaryCategoryId);
    if (r.childCategoryId) categoryIdsSet.add(r.childCategoryId);
  });

  // Fetch category names and display orders
  const categoryMap = new Map<number, { name: string; displayOrder: number; parentId: number | null }>();
  if (categoryIdsSet.size > 0) {
    const cats = await db
      .select({ 
        id: categories.id, 
        name: categories.name, 
        displayOrder: categories.displayOrder,
        parentId: categories.parentId
      })
      .from(categories)
      .where(inArray(categories.id, Array.from(categoryIdsSet)));

    cats.forEach((c) => categoryMap.set(c.id, { 
      name: c.name, 
      displayOrder: c.displayOrder || 0,
      parentId: c.parentId
    }));
  }

  // Group by main category and sub-category
  const categoryDataMap = new Map<number, MainCategoryData>();
  const UNCATEGORIZED_ID = -1; // Special ID for uncategorized

  results.forEach((r) => {
    const mainCatId = r.primaryCategoryId || UNCATEGORIZED_ID;
    const subCatId = r.childCategoryId;
    // Handle refunds: negate the amount if it's a refund
    const amount = r.isRefund
      ? -Math.abs(Number(r.chargedAmountIls))
      : Number(r.chargedAmountIls);
    const yearMonth = r.paymentDate.substring(0, 7);
    const year = r.paymentDate.substring(0, 4);

    // Ensure main category exists
    if (!categoryDataMap.has(mainCatId)) {
      categoryDataMap.set(mainCatId, {
        mainCategoryId: mainCatId,
        mainCategoryName: mainCatId === UNCATEGORIZED_ID ? 'Uncategorized' : (categoryMap.get(mainCatId)?.name || 'Unknown'),
        subCategories: [],
        categoryTotal: 0,
      });
    }

    const mainCat = categoryDataMap.get(mainCatId)!;

    // Find or create sub-category
    let subCat = mainCat.subCategories.find(
      (sc) => sc.subCategoryId === subCatId
    );

    if (!subCat) {
      subCat = {
        subCategoryId: subCatId,
        subCategoryName: subCatId ? categoryMap.get(subCatId)?.name || null : null,
        monthlyExpenses: {},
        monthlyBudgets: {},
        budgetPeriod: null,
        annualBudgetAmount: null,
        yearToDateTotal: {},
        rowTotal: 0,
      };
      mainCat.subCategories.push(subCat);
    }

    // Add to monthly total
    if (!subCat.monthlyExpenses[yearMonth]) {
      subCat.monthlyExpenses[yearMonth] = 0;
    }
    subCat.monthlyExpenses[yearMonth] += amount;

    // Add to year-to-date total
    if (!subCat.yearToDateTotal[year]) {
      subCat.yearToDateTotal[year] = 0;
    }
    subCat.yearToDateTotal[year] += amount;

    subCat.rowTotal += amount;
    mainCat.categoryTotal += amount;
  });

  // Fetch budgets for all months
  const budgetPromises = months.map(async (yearMonth) => {
    const [year, month] = yearMonth.split('-').map(Number);
    return { yearMonth, budgets: await getBudgetsForMonth(year, month) };
  });

  const budgetResults = await Promise.all(budgetPromises);

  // Map budgets to categories
  budgetResults.forEach(({ yearMonth, budgets }) => {
    budgets.forEach((budget, categoryId) => {
      // Find the category in our data
      categoryDataMap.forEach((mainCat) => {
        mainCat.subCategories.forEach((subCat) => {
          if (subCat.subCategoryId === categoryId) {
            subCat.monthlyBudgets[yearMonth] = parseFloat(budget.budgetAmount);
          }
        });
      });
    });
  });

  // Calculate column totals
  const columnTotals: Record<string, number> = {};
  let grandTotal = 0;

  categoryDataMap.forEach((mainCat) => {
    mainCat.subCategories.forEach((subCat) => {
      Object.entries(subCat.monthlyExpenses).forEach(([month, amount]) => {
        if (!columnTotals[month]) {
          columnTotals[month] = 0;
        }
        columnTotals[month] += amount;
        grandTotal += amount;
      });
    });
  });

  // Sort categories by display_order
  const sortedCategories = Array.from(categoryDataMap.values()).sort((a, b) => {
    const aOrder = a.mainCategoryId === UNCATEGORIZED_ID ? 9999 : (categoryMap.get(a.mainCategoryId)?.displayOrder || 0);
    const bOrder = b.mainCategoryId === UNCATEGORIZED_ID ? 9999 : (categoryMap.get(b.mainCategoryId)?.displayOrder || 0);
    return aOrder - bOrder;
  });

  // Sort subcategories within each main category by display_order
  sortedCategories.forEach((mainCat) => {
    mainCat.subCategories.sort((a, b) => {
      if (!a.subCategoryId && !b.subCategoryId) return 0;
      if (!a.subCategoryId) return 1; // null subcategories go last
      if (!b.subCategoryId) return -1;
      
      const aOrder = categoryMap.get(a.subCategoryId)?.displayOrder || 0;
      const bOrder = categoryMap.get(b.subCategoryId)?.displayOrder || 0;
      return aOrder - bOrder;
    });
  });

  return {
    months,
    categories: sortedCategories,
    columnTotals,
    grandTotal,
  };
}
