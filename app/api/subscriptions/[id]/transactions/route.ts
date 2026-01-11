import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subscriptionId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'completed', 'projected', or null (all)

    let query = db
      .select({
        id: transactions.id,
        date: transactions.dealDate,
        amount: transactions.chargedAmountIls,
        status: transactions.status,
      })
      .from(transactions)
      .where(eq(transactions.subscriptionId, subscriptionId))
      .$dynamic();

    if (statusFilter) {
      query = query.where(
        and(
          eq(transactions.subscriptionId, subscriptionId),
          eq(transactions.status, statusFilter as any)
        )
      );
    }

    const results = await query;

    return NextResponse.json({ transactions: results });
  } catch (error) {
    console.error('Error fetching subscription transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
