import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, businesses, categories } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import {
  startOfMonth, endOfMonth, subMonths, format,
  startOfYear, endOfYear, subYears, addMonths,
} from 'date-fns';
import type { MonthlyTrendRow, TransactionTypeSplitRow, TopBusinessRow } from '@/lib/services/reports-service';

export type DashboardMode = 'this_month' | 'last_month' | 'this_year' | 'last_year';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') || 'this_month') as DashboardMode;
    const isYearly = mode === 'this_year' || mode === 'last_year';

    const now = new Date();
    let selectedStart: Date, selectedEnd: Date;
    let prevStart: Date, prevEnd: Date;
    let trendStart: Date, trendEnd: Date;
    let trendMonthCount: number;

    if (mode === 'this_month') {
      selectedStart = startOfMonth(now);
      selectedEnd = endOfMonth(now);
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfMonth(subMonths(now, 1));
      trendStart = subMonths(startOfMonth(now), 5);
      trendEnd = endOfMonth(now);
      trendMonthCount = 6;
    } else if (mode === 'last_month') {
      const lm = subMonths(now, 1);
      selectedStart = startOfMonth(lm);
      selectedEnd = endOfMonth(lm);
      prevStart = startOfMonth(subMonths(now, 2));
      prevEnd = endOfMonth(subMonths(now, 2));
      trendStart = subMonths(startOfMonth(now), 5);
      trendEnd = endOfMonth(now);
      trendMonthCount = 6;
    } else if (mode === 'this_year') {
      selectedStart = startOfYear(now);
      selectedEnd = endOfYear(now);
      prevStart = startOfYear(subYears(now, 1));
      prevEnd = endOfYear(subYears(now, 1));
      trendStart = startOfYear(now);
      trendEnd = endOfYear(now);
      trendMonthCount = 12;
    } else {
      // last_year
      const ly = subYears(now, 1);
      selectedStart = startOfYear(ly);
      selectedEnd = endOfYear(ly);
      prevStart = startOfYear(subYears(now, 2));
      prevEnd = endOfYear(subYears(now, 2));
      trendStart = startOfYear(ly);
      trendEnd = endOfYear(ly);
      trendMonthCount = 12;
    }

    // Rolling 6-month avg (monthly modes only — always from today looking back)
    const sixMonthsAgo = subMonths(startOfMonth(now), 6);
    const nowMonthEnd = endOfMonth(now);

    const dateExpr = sql`COALESCE(${transactions.actualChargeDate}, ${transactions.bankChargeDate}, ${transactions.dealDate})`;
    const toDate = (d: Date) => d.toISOString().split('T')[0];

    const grossExpr = sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0)`;
    const refundsExpr = sql<string>`COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0)`;

    const kpiQuery = (start: Date, end: Date) =>
      db
        .select({ gross: grossExpr, refunds: refundsExpr })
        .from(transactions)
        .where(and(
          eq(transactions.status, 'completed'),
          gte(dateExpr, toDate(start)),
          lte(dateExpr, toDate(end)),
        ));

    const [
      selectedKPI,
      prevKPI,
      sixMonthKPI,
      trendRows,
      typeSplitRows,
      topMerchantsRows,
      categoryBreakdown,
      recentTransactionsRaw,
    ] = await Promise.all([
      kpiQuery(selectedStart, selectedEnd),
      kpiQuery(prevStart, prevEnd),
      // For yearly modes we compute avg from selected total — still run but won't be used
      isYearly
        ? Promise.resolve([{ gross: '0', refunds: '0' }])
        : kpiQuery(sixMonthsAgo, nowMonthEnd),

      // Trend: grouped by YYYY-MM, completed + projected
      db.execute(sql`
        SELECT
          to_char(COALESCE(${transactions.actualChargeDate}, ${transactions.bankChargeDate}, ${transactions.dealDate})::date, 'YYYY-MM') AS month,
          COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0) AS gross,
          COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0) AS refunds
        FROM ${transactions}
        WHERE ${transactions.status} IN ('completed', 'projected')
          AND COALESCE(${transactions.actualChargeDate}, ${transactions.bankChargeDate}, ${transactions.dealDate}) >= ${toDate(trendStart)}
          AND COALESCE(${transactions.actualChargeDate}, ${transactions.bankChargeDate}, ${transactions.dealDate}) <= ${toDate(trendEnd)}
        GROUP BY month
        ORDER BY month
      `),

      // Transaction type split for selected period
      db.execute(sql`
        SELECT
          ${transactions.transactionType} AS type,
          COALESCE(SUM(CASE WHEN ${transactions.isRefund} = false THEN ${transactions.chargedAmountIls} ELSE 0 END), 0) AS gross,
          COALESCE(SUM(CASE WHEN ${transactions.isRefund} = true THEN ABS(${transactions.chargedAmountIls}) ELSE 0 END), 0) AS refunds
        FROM ${transactions}
        WHERE ${transactions.status} = 'completed'
          AND COALESCE(${transactions.actualChargeDate}, ${transactions.bankChargeDate}, ${transactions.dealDate}) >= ${toDate(selectedStart)}
          AND COALESCE(${transactions.actualChargeDate}, ${transactions.bankChargeDate}, ${transactions.dealDate}) <= ${toDate(selectedEnd)}
        GROUP BY ${transactions.transactionType}
      `),

      // Top 5 merchants for selected period
      db.execute(sql`
        SELECT
          b.id AS business_id,
          b.display_name AS business_name,
          COALESCE(c.name, 'Uncategorized') AS category_name,
          COUNT(t.id)::int AS transaction_count,
          COALESCE(SUM(CASE WHEN t.is_refund = false THEN t.charged_amount_ils ELSE 0 END), 0) AS gross,
          COALESCE(SUM(CASE WHEN t.is_refund = true THEN ABS(t.charged_amount_ils) ELSE 0 END), 0) AS refunds
        FROM transactions t
        LEFT JOIN businesses b ON t.business_id = b.id
        LEFT JOIN categories c ON b.primary_category_id = c.id
        WHERE t.status = 'completed'
          AND COALESCE(t.actual_charge_date, t.bank_charge_date, t.deal_date) >= ${toDate(selectedStart)}
          AND COALESCE(t.actual_charge_date, t.bank_charge_date, t.deal_date) <= ${toDate(selectedEnd)}
        GROUP BY b.id, b.display_name, c.name
        ORDER BY (SUM(CASE WHEN t.is_refund = false THEN t.charged_amount_ils ELSE 0 END) - SUM(CASE WHEN t.is_refund = true THEN ABS(t.charged_amount_ils) ELSE 0 END)) DESC
        LIMIT 5
      `),

      // Category breakdown for selected period (gross, parent categories, for pie)
      db.execute(sql`
        SELECT
          c.id,
          c.name,
          COALESCE(SUM(CASE WHEN t.is_refund = false THEN t.charged_amount_ils ELSE 0 END), 0) as total
        FROM categories c
        LEFT JOIN businesses b ON (b.primary_category_id = c.id)
        LEFT JOIN transactions t ON (
          t.business_id = b.id
          AND t.status = 'completed'
          AND COALESCE(t.actual_charge_date, t.bank_charge_date, t.deal_date) >= ${toDate(selectedStart)}
          AND COALESCE(t.actual_charge_date, t.bank_charge_date, t.deal_date) <= ${toDate(selectedEnd)}
        )
        WHERE c.level = 0
        GROUP BY c.id, c.name
        ORDER BY total DESC
      `),

      // Recent transactions: always last 10 completed
      db.execute(sql`
        SELECT
          t.id,
          b.display_name as business_name,
          t.charged_amount_ils as amount,
          COALESCE(t.actual_charge_date, t.bank_charge_date, t.deal_date) as date,
          COALESCE(child_cat.name, parent_cat.name, 'Uncategorized') as category_name
        FROM transactions t
        INNER JOIN businesses b ON t.business_id = b.id
        LEFT JOIN categories parent_cat ON b.primary_category_id = parent_cat.id
        LEFT JOIN categories child_cat ON b.child_category_id = child_cat.id
        WHERE t.status = 'completed'
        ORDER BY COALESCE(t.actual_charge_date, t.bank_charge_date, t.deal_date) DESC
        LIMIT 10
      `),
    ]);

    // --- KPIs ---
    const selGross = parseFloat(selectedKPI[0]?.gross || '0');
    const selRefunds = parseFloat(selectedKPI[0]?.refunds || '0');
    const selNet = selGross - selRefunds;

    const prevGross = parseFloat(prevKPI[0]?.gross || '0');
    const prevRefunds = parseFloat(prevKPI[0]?.refunds || '0');
    const prevNet = prevGross - prevRefunds;

    let avgNet: number;
    if (isYearly) {
      avgNet = selNet / 12;
    } else {
      const sixGross = parseFloat((sixMonthKPI as any[])[0]?.gross || '0');
      const sixRefunds = parseFloat((sixMonthKPI as any[])[0]?.refunds || '0');
      avgNet = (sixGross - sixRefunds) / 6;
    }

    const changeFromPrev = prevNet > 0 ? ((selNet - prevNet) / prevNet) * 100 : 0;

    // --- Trend (fill missing months with zeros) ---
    const trendMap = new Map<string, { gross: number; refunds: number }>();
    for (const row of trendRows as any[]) {
      trendMap.set(row.month, {
        gross: parseFloat(row.gross || '0'),
        refunds: parseFloat(row.refunds || '0'),
      });
    }
    const monthlyTrend: MonthlyTrendRow[] = [];
    for (let i = 0; i < trendMonthCount; i++) {
      const monthKey = format(addMonths(trendStart, i), 'yyyy-MM');
      const entry = trendMap.get(monthKey) ?? { gross: 0, refunds: 0 };
      monthlyTrend.push({
        month: monthKey,
        gross: entry.gross,
        refunds: entry.refunds,
        net: entry.gross - entry.refunds,
      });
    }

    // --- Transaction Type Split ---
    const typeMap = new Map<string, { gross: number; refunds: number }>();
    for (const row of typeSplitRows as any[]) {
      typeMap.set(row.type, {
        gross: parseFloat(row.gross || '0'),
        refunds: parseFloat(row.refunds || '0'),
      });
    }
    const ALL_TYPES: TransactionTypeSplitRow['type'][] = ['one_time', 'installment', 'subscription'];
    const transactionTypeSplit: TransactionTypeSplitRow[] = ALL_TYPES.map((type) => {
      const entry = typeMap.get(type) ?? { gross: 0, refunds: 0 };
      return { type, gross: entry.gross, refunds: entry.refunds, net: entry.gross - entry.refunds };
    });

    // --- Top Merchants ---
    const topMerchants: TopBusinessRow[] = (topMerchantsRows as any[]).map((row) => {
      const gross = parseFloat(row.gross || '0');
      const refunds = parseFloat(row.refunds || '0');
      return {
        businessId: row.business_id,
        businessName: row.business_name,
        categoryName: row.category_name,
        transactionCount: row.transaction_count,
        gross,
        refunds,
        net: gross - refunds,
      };
    });

    // --- Category Breakdown ---
    const categoryData = (categoryBreakdown as any[]).map((row: any) => ({
      category: row.name,
      spending: parseFloat(row.total || '0'),
    }));

    // --- Recent Transactions ---
    const recentTransactions = (recentTransactionsRaw as any[]).map((row: any) => ({
      id: row.id,
      businessName: row.business_name,
      amount: parseFloat(row.amount),
      date: row.date,
      category: row.category_name,
    }));

    return NextResponse.json({
      kpis: {
        thisMonth: { gross: selGross, refunds: selRefunds, net: selNet },
        lastMonth: { gross: prevGross, refunds: prevRefunds, net: prevNet },
        avgNet,
        changeFromPrev,
      },
      monthlyTrend,
      categoryBreakdown: categoryData,
      transactionTypeSplit,
      topMerchants,
      recentTransactions,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    });
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
