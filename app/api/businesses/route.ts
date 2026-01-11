import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses, categories } from '@/lib/db/schema';
import { sql, eq, ilike, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const approvedOnly = searchParams.get('approved_only');
    const uncategorized = searchParams.get('uncategorized');
    const sort = searchParams.get('sort') || 'name';

    // Build query conditions using raw SQL
    const conditions: string[] = [];

    // ALWAYS exclude merged businesses (where mergedToId IS NOT NULL)
    conditions.push('b.merged_to_id IS NULL');

    if (search) {
      conditions.push(`b.display_name ILIKE '%${search.replace(/'/g, "''")}%'`);
    }

    if (approvedOnly === 'true') {
      conditions.push('b.approved = true');
    } else if (approvedOnly === 'false') {
      conditions.push('b.approved = false');
    }

    if (uncategorized === 'true') {
      conditions.push('b.primary_category_id IS NULL');
    }

    // Fetch businesses with transaction counts and category names using raw SQL
    const whereClause = conditions.length > 0 ? sql.raw(`WHERE ${conditions.join(' AND ')}`) : sql.raw('');

    // Build order clause based on sort parameter
    let orderClause;
    switch (sort) {
      case 'name':
        orderClause = sql.raw('ORDER BY b.display_name ASC');
        break;
      case 'name_desc':
        orderClause = sql.raw('ORDER BY b.display_name DESC');
        break;
      case 'total_spent':
        orderClause = sql.raw('ORDER BY total_spent DESC');
        break;
      case 'total_spent_asc':
        orderClause = sql.raw('ORDER BY total_spent ASC');
        break;
      case 'transaction_count':
        orderClause = sql.raw('ORDER BY transaction_count DESC');
        break;
      case 'transaction_count_asc':
        orderClause = sql.raw('ORDER BY transaction_count ASC');
        break;
      case 'last_used_date':
        orderClause = sql.raw('ORDER BY last_used_date DESC NULLS LAST');
        break;
      case 'last_used_date_asc':
        orderClause = sql.raw('ORDER BY last_used_date ASC NULLS LAST');
        break;
      default:
        orderClause = sql.raw('ORDER BY b.display_name ASC');
    }

    const result = await db.execute(sql`
      SELECT
        b.id,
        b.normalized_name,
        b.display_name,
        b.primary_category_id,
        b.child_category_id,
        b.categorization_source,
        b.approved,
        COALESCE((SELECT COUNT(*)::int FROM transactions t WHERE t.business_id = b.id), 0) as transaction_count,
        COALESCE((SELECT SUM(charged_amount_ils) FROM transactions t WHERE t.business_id = b.id AND t.status = 'completed'), 0) as total_spent,
        (SELECT MAX(deal_date)::text FROM transactions t WHERE t.business_id = b.id) as last_used_date
      FROM businesses b
      ${whereClause}
      ${orderClause}
    `);

    const allBusinesses = (result as any[]).map(row => ({
      id: row.id as number,
      normalized_name: row.normalized_name as string,
      display_name: row.display_name as string,
      primary_category_id: row.primary_category_id as number | null,
      child_category_id: row.child_category_id as number | null,
      categorization_source: row.categorization_source as string | null,
      approved: row.approved as boolean,
      transaction_count: row.transaction_count as number,
      total_spent: parseFloat(row.total_spent || '0'),
      last_used_date: row.last_used_date as string | null,
    }));

    // Fetch category names in bulk
    const categoryIds = new Set<number>();
    allBusinesses.forEach((b) => {
      if (b.primary_category_id) categoryIds.add(b.primary_category_id);
      if (b.child_category_id) categoryIds.add(b.child_category_id);
    });

    const categoryList = await db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(
        categoryIds.size > 0
          ? sql`${categories.id} IN (${sql.raw(
              Array.from(categoryIds).join(',')
            )})`
          : undefined
      );

    const categoryMap = new Map(categoryList.map((c) => [c.id, c.name]));

    // Format response
    const formatted = allBusinesses.map((b: any) => ({
      id: b.id,
      normalized_name: b.normalized_name,
      display_name: b.display_name,
      primary_category: b.primary_category_id
        ? {
            id: b.primary_category_id,
            name: categoryMap.get(b.primary_category_id) || 'Unknown',
          }
        : null,
      child_category: b.child_category_id
        ? {
            id: b.child_category_id,
            name: categoryMap.get(b.child_category_id) || 'Unknown',
          }
        : null,
      categorization_source: b.categorization_source,
      approved: b.approved,
      transaction_count: b.transaction_count || 0,
      total_spent: b.total_spent || 0,
      last_used_date: b.last_used_date,
    }));

    return NextResponse.json({
      total: formatted.length,
      businesses: formatted,
    });
  } catch (error) {
    console.error('[API] Failed to fetch businesses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch businesses' },
      { status: 500 }
    );
  }
}
