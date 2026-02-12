import { db } from '@/lib/db';
import { transactions, businesses, categories } from '@/lib/db/schema';
import { eq, and, inArray, sql, SQL } from 'drizzle-orm';

export interface ReportsFilters {
  dateFrom: string;
  dateTo: string;
  cardIds?: number[];
  parentCategoryIds?: number[];
}

export interface ReportsSummary {
  gross: number;
  refunds: number;
  net: number;
  monthlyAvgNet: number;
  monthCount: number;
}

export interface MonthlyTrendRow {
  month: string;
  gross: number;
  refunds: number;
  net: number;
}

export interface CategoryBreakdownChild {
  categoryId: number;
  categoryName: string;
  gross: number;
  refunds: number;
  net: number;
}

export interface CategoryBreakdownRow {
  categoryId: number;
  categoryName: string;
  gross: number;
  refunds: number;
  net: number;
  percentage: number;
  children: CategoryBreakdownChild[];
}

export interface TopBusinessRow {
  businessId: number;
  businessName: string;
  categoryName: string;
  transactionCount: number;
  gross: number;
  refunds: number;
  net: number;
}

export interface TransactionTypeSplitRow {
  type: 'one_time' | 'installment' | 'subscription';
  gross: number;
  refunds: number;
  net: number;
}

export interface CategoryMeta {
  categoryId: number;
  categoryName: string;
  displayOrder: number;
}

export interface ReportsResponse {
  summary: ReportsSummary;
  monthlyTrend: MonthlyTrendRow[];
  categoryBreakdown: CategoryBreakdownRow[];
  categoryTrends: Array<Record<string, number | string>>;
  topBusinesses: TopBusinessRow[];
  byTransactionType: TransactionTypeSplitRow[];
  months: string[];
  categoryMeta: CategoryMeta[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

const paymentDateExpr = sql<string>`COALESCE(${transactions.actualChargeDate}::text, ${transactions.projectedChargeDate}::text, ${transactions.bankChargeDate}::text, ${transactions.dealDate}::text)`;

function buildConditions(filters: ReportsFilters): SQL[] {
  const conditions: SQL[] = [];
  conditions.push(sql`${paymentDateExpr} >= ${filters.dateFrom}`);
  conditions.push(sql`${paymentDateExpr} <= ${filters.dateTo}`);
  // Include completed + projected (matches time-flow behaviour)
  conditions.push(sql`${transactions.status} IN ('completed', 'projected')`);
  if (filters.cardIds?.length) conditions.push(inArray(transactions.cardId, filters.cardIds));
  if (filters.parentCategoryIds?.length) {
    conditions.push(inArray(businesses.primaryCategoryId, filters.parentCategoryIds));
  }
  return conditions;
}

/** Generate YYYY-MM strings for the inclusive range. */
function generateMonths(dateFrom: string, dateTo: string): string[] {
  const months: string[] = [];
  const [fromY, fromM] = dateFrom.split('-').map(Number);
  const [toY, toM] = dateTo.split('-').map(Number);
  let y = fromY, m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ─── sub-queries ─────────────────────────────────────────────────────────────

async function querySummary(filters: ReportsFilters, monthCount: number): Promise<ReportsSummary> {
  // Summary uses completed only (factual totals, not projections)
  const conditions: SQL[] = [
    sql`${paymentDateExpr} >= ${filters.dateFrom}`,
    sql`${paymentDateExpr} <= ${filters.dateTo}`,
    eq(transactions.status, 'completed'),
  ];
  if (filters.cardIds?.length) conditions.push(inArray(transactions.cardId, filters.cardIds));
  if (filters.parentCategoryIds?.length) conditions.push(inArray(businesses.primaryCategoryId, filters.parentCategoryIds));

  const rows = await db
    .select({
      gross: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0)`,
      refunds: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .where(and(...conditions));

  const gross = parseFloat(rows[0]?.gross ?? '0');
  const refunds = parseFloat(rows[0]?.refunds ?? '0');
  const net = gross - refunds;

  return {
    gross,
    refunds,
    net,
    monthlyAvgNet: monthCount > 0 ? net / monthCount : 0,
    monthCount,
  };
}

async function queryMonthlyTrend(
  baseConditions: SQL[],
  months: string[]
): Promise<MonthlyTrendRow[]> {
  // Single query: group by year-month
  const where = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const rows = await db
    .select({
      yearMonth: sql<string>`to_char(${paymentDateExpr}::date, 'YYYY-MM')`,
      gross: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0)`,
      refunds: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .where(where)
    .groupBy(sql`to_char(${paymentDateExpr}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${paymentDateExpr}::date, 'YYYY-MM')`);

  // Index results by month
  const byMonth = new Map<string, { gross: number; refunds: number }>();
  rows.forEach((r) => {
    byMonth.set(r.yearMonth, {
      gross: parseFloat(r.gross),
      refunds: parseFloat(r.refunds),
    });
  });

  // Return all months in range, filling zeros for missing ones
  return months.map((m) => {
    const d = byMonth.get(m) ?? { gross: 0, refunds: 0 };
    return { month: m, gross: d.gross, refunds: d.refunds, net: d.gross - d.refunds };
  });
}

async function queryCategoryBreakdown(conditions: SQL[]): Promise<{
  breakdown: CategoryBreakdownRow[];
  meta: CategoryMeta[];
}> {
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      primaryCategoryId: businesses.primaryCategoryId,
      childCategoryId: businesses.childCategoryId,
      gross: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0)`,
      refunds: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .where(where)
    .groupBy(businesses.primaryCategoryId, businesses.childCategoryId);

  // Collect all category IDs
  const catIds = new Set<number>();
  rows.forEach((r) => {
    if (r.primaryCategoryId) catIds.add(r.primaryCategoryId);
    if (r.childCategoryId) catIds.add(r.childCategoryId);
  });

  // Fetch category metadata
  const catMap = new Map<number, { name: string; displayOrder: number; parentId: number | null }>();
  if (catIds.size > 0) {
    const cats = await db
      .select({ id: categories.id, name: categories.name, displayOrder: categories.displayOrder, parentId: categories.parentId })
      .from(categories)
      .where(inArray(categories.id, Array.from(catIds)));
    cats.forEach((c) => catMap.set(c.id, { name: c.name, displayOrder: c.displayOrder || 0, parentId: c.parentId }));
  }

  // Group by parent category
  const parentMap = new Map<number, { gross: number; refunds: number; children: Map<number, { gross: number; refunds: number }> }>();

  rows.forEach((r) => {
    const parentId = r.primaryCategoryId;
    if (!parentId) return; // skip uncategorized for breakdown
    const gross = parseFloat(r.gross);
    const refunds = parseFloat(r.refunds);

    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, { gross: 0, refunds: 0, children: new Map() });
    }
    const parent = parentMap.get(parentId)!;
    parent.gross += gross;
    parent.refunds += refunds;

    if (r.childCategoryId) {
      const childId = r.childCategoryId;
      if (!parent.children.has(childId)) {
        parent.children.set(childId, { gross: 0, refunds: 0 });
      }
      const child = parent.children.get(childId)!;
      child.gross += gross;
      child.refunds += refunds;
    }
  });

  // Calculate total net for percentages
  let totalNet = 0;
  parentMap.forEach((p) => { totalNet += p.gross - p.refunds; });

  // Build sorted result
  const breakdown: CategoryBreakdownRow[] = Array.from(parentMap.entries())
    .map(([catId, data]) => {
      const net = data.gross - data.refunds;
      const meta = catMap.get(catId);
      const children: CategoryBreakdownChild[] = Array.from(data.children.entries())
        .map(([childId, childData]) => ({
          categoryId: childId,
          categoryName: catMap.get(childId)?.name ?? 'Unknown',
          gross: childData.gross,
          refunds: childData.refunds,
          net: childData.gross - childData.refunds,
        }))
        .sort((a, b) => b.net - a.net);

      return {
        categoryId: catId,
        categoryName: meta?.name ?? 'Unknown',
        gross: data.gross,
        refunds: data.refunds,
        net,
        percentage: totalNet > 0 ? (net / totalNet) * 100 : 0,
        children,
      };
    })
    .sort((a, b) => {
      const aOrder = catMap.get(a.categoryId)?.displayOrder ?? 9999;
      const bOrder = catMap.get(b.categoryId)?.displayOrder ?? 9999;
      return aOrder - bOrder;
    });

  // Build category meta for color mapping (parent categories only, sorted by displayOrder)
  const meta: CategoryMeta[] = breakdown.map((b) => ({
    categoryId: b.categoryId,
    categoryName: b.categoryName,
    displayOrder: catMap.get(b.categoryId)?.displayOrder ?? 9999,
  }));

  return { breakdown, meta };
}

async function queryCategoryTrends(
  conditions: SQL[],
  months: string[]
): Promise<Array<Record<string, number | string>>> {
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      yearMonth: sql<string>`to_char(${paymentDateExpr}::date, 'YYYY-MM')`,
      primaryCategoryId: businesses.primaryCategoryId,
      net: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE -ABS(${transactions.chargedAmountIls}) END), 0)`,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .where(where)
    .groupBy(sql`to_char(${paymentDateExpr}::date, 'YYYY-MM')`, businesses.primaryCategoryId)
    .orderBy(sql`to_char(${paymentDateExpr}::date, 'YYYY-MM')`);

  // Collect category IDs for name lookup
  const catIds = new Set<number>();
  rows.forEach((r) => { if (r.primaryCategoryId) catIds.add(r.primaryCategoryId); });

  const catNames = new Map<number, string>();
  if (catIds.size > 0) {
    const cats = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(inArray(categories.id, Array.from(catIds)));
    cats.forEach((c) => catNames.set(c.id, c.name));
  }

  // Build pivot: month → { categoryName: netAmount }
  const pivot = new Map<string, Record<string, number>>();
  months.forEach((m) => pivot.set(m, {}));

  rows.forEach((r) => {
    if (!r.primaryCategoryId) return;
    const catName = catNames.get(r.primaryCategoryId) ?? 'Unknown';
    const monthData = pivot.get(r.yearMonth);
    if (monthData) {
      monthData[catName] = (monthData[catName] ?? 0) + parseFloat(r.net);
    }
  });

  return months.map((m) => ({ month: m, ...pivot.get(m) }));
}

async function queryTopBusinesses(conditions: SQL[]): Promise<TopBusinessRow[]> {
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Use Drizzle query builder so column refs match the join context (no alias conflicts)
  const parentCategories = categories;
  const rows = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.displayName,
      categoryName: sql<string>`COALESCE(${parentCategories.name}, 'Uncategorized')`,
      transactionCount: sql<number>`COUNT(${transactions.id})::int`,
      gross: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0)`,
      refunds: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0)`,
      net: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE -ABS(${transactions.chargedAmountIls}) END), 0)`,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .leftJoin(categories, eq(businesses.primaryCategoryId, categories.id))
    .where(where)
    .groupBy(businesses.id, businesses.displayName, categories.name)
    .orderBy(sql`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE -ABS(${transactions.chargedAmountIls}) END), 0) DESC`)
    .limit(15);

  return rows.map((r) => ({
    businessId: r.businessId ?? 0,
    businessName: r.businessName ?? 'Unknown',
    categoryName: r.categoryName ?? 'Uncategorized',
    transactionCount: r.transactionCount ?? 0,
    gross: parseFloat(r.gross ?? '0'),
    refunds: parseFloat(r.refunds ?? '0'),
    net: parseFloat(r.net ?? '0'),
  }));
}

async function queryByTransactionType(conditions: SQL[]): Promise<TransactionTypeSplitRow[]> {
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      type: transactions.transactionType,
      gross: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0)`,
      refunds: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(businesses, eq(transactions.businessId, businesses.id))
    .where(where)
    .groupBy(transactions.transactionType);

  const typeMap = new Map<string, TransactionTypeSplitRow>();
  rows.forEach((r) => {
    if (!r.type) return;
    const gross = parseFloat(r.gross);
    const refunds = parseFloat(r.refunds);
    typeMap.set(r.type, { type: r.type as any, gross, refunds, net: gross - refunds });
  });

  return (['one_time', 'installment', 'subscription'] as const).map((type) =>
    typeMap.get(type) ?? { type, gross: 0, refunds: 0, net: 0 }
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function queryReports(filters: ReportsFilters): Promise<ReportsResponse> {
  const months = generateMonths(filters.dateFrom, filters.dateTo);
  const baseConditions = buildConditions(filters);

  const [summary, monthlyTrend, categoryResult, categoryTrends, topBusinesses, byTransactionType] =
    await Promise.all([
      querySummary(filters, months.length),
      queryMonthlyTrend(baseConditions, months),
      queryCategoryBreakdown(baseConditions),
      queryCategoryTrends(baseConditions, months),
      queryTopBusinesses(baseConditions),
      queryByTransactionType(baseConditions),
    ]);

  return {
    summary,
    monthlyTrend,
    categoryBreakdown: categoryResult.breakdown,
    categoryTrends,
    topBusinesses,
    byTransactionType,
    months,
    categoryMeta: categoryResult.meta,
  };
}
