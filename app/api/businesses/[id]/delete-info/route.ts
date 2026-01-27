import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { error: 'Invalid business ID' },
        { status: 400 }
      );
    }

    // Get parent business info with transaction stats (only transactions originally from this business)
    const parentInfo = await db.execute(sql`
      SELECT
        COALESCE(COUNT(t.id), 0)::int as transaction_count,
        COALESCE(SUM(t.charged_amount_ils), 0)::numeric as total_spent
      FROM transactions t
      WHERE t.business_id = ${businessId}
        AND (t.original_business_id = ${businessId} OR t.original_business_id IS NULL)
    `);

    // Get merged businesses info (transactions where original_business_id matches the merged business)
    const mergedInfo = await db.execute(sql`
      SELECT
        b.id,
        b.display_name,
        b.normalized_name,
        COALESCE(COUNT(t.id), 0)::int as transaction_count,
        COALESCE(SUM(t.charged_amount_ils), 0)::numeric as total_spent
      FROM businesses b
      LEFT JOIN transactions t ON t.original_business_id = b.id
      WHERE b.merged_to_id = ${businessId}
      GROUP BY b.id, b.display_name, b.normalized_name
      ORDER BY b.display_name
    `);

    const parentRow = (parentInfo as any[])[0];
    const mergedRows = mergedInfo as any[];

    const mergedBusinesses = mergedRows.map(row => ({
      id: row.id as number,
      displayName: row.display_name as string,
      normalizedName: row.normalized_name as string,
      transactionCount: row.transaction_count as number,
      totalSpent: parseFloat(row.total_spent || '0'),
    }));

    const mergedTotalTransactions = mergedBusinesses.reduce((sum, b) => sum + b.transactionCount, 0);
    const mergedTotalSpent = mergedBusinesses.reduce((sum, b) => sum + b.totalSpent, 0);

    return NextResponse.json({
      hasMergedBusinesses: mergedBusinesses.length > 0,
      parentTransactionCount: parentRow?.transaction_count || 0,
      parentTotalSpent: parseFloat(parentRow?.total_spent || '0'),
      mergedBusinesses,
      mergedTotalTransactions,
      mergedTotalSpent,
    });
  } catch (error) {
    console.error('[API] Failed to fetch business delete info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business delete info' },
      { status: 500 }
    );
  }
}
