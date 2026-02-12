import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryReports } from '@/lib/services/reports-service';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

const reportsQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  card_ids: z.string().optional(),
  parent_category_ids: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validated = reportsQuerySchema.safeParse(params);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validated.error.issues },
        { status: 400 }
      );
    }

    const { date_from, date_to, card_ids, parent_category_ids } = validated.data;

    // Defaults: last 12 months
    const now = new Date();
    const defaultFrom = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
    const defaultTo = format(endOfMonth(now), 'yyyy-MM-dd');

    const result = await queryReports({
      dateFrom: date_from ?? defaultFrom,
      dateTo: date_to ?? defaultTo,
      cardIds: card_ids?.split(',').map(Number).filter(Boolean),
      parentCategoryIds: parent_category_ids?.split(',').map(Number).filter(Boolean),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reports API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
