import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    // Fetch all merged businesses with their target business info
    const result = await db.execute(sql`
      SELECT
        b.id,
        b.normalized_name,
        b.display_name,
        b.merged_to_id,
        b.created_at,
        b.updated_at,
        target.display_name as target_business_name,
        target.normalized_name as target_normalized_name,
        COALESCE((SELECT COUNT(*)::int FROM transactions t WHERE t.business_id = target.id), 0) as target_transaction_count,
        COALESCE((SELECT COUNT(*)::int FROM transactions t WHERE t.original_business_id = b.id), 0) as original_transaction_count
      FROM businesses b
      INNER JOIN businesses target ON b.merged_to_id = target.id
      WHERE b.merged_to_id IS NOT NULL
      ORDER BY b.updated_at DESC
    `);

    const mergedBusinesses = (result as any[]).map(row => ({
      id: row.id as number,
      normalized_name: row.normalized_name as string,
      display_name: row.display_name as string,
      merged_to_id: row.merged_to_id as number,
      created_at: row.created_at as string,
      merged_at: row.updated_at as string, // updated_at is when merge happened
      target_business_name: row.target_business_name as string,
      target_normalized_name: row.target_normalized_name as string,
      target_transaction_count: row.target_transaction_count as number,
      original_transaction_count: row.original_transaction_count as number,
    }));

    return NextResponse.json({
      total: mergedBusinesses.length,
      merged_businesses: mergedBusinesses,
    });
  } catch (error) {
    console.error('[API] Failed to fetch merged businesses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merged businesses' },
      { status: 500 }
    );
  }
}
