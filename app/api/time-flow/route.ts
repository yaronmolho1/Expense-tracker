import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryTimeFlow } from '@/lib/services/time-flow-service';

const timeFlowQuerySchema = z.object({
  months_back: z.coerce.number().int().min(1).max(24).default(6),
  months_forward: z.coerce.number().int().min(0).max(24).default(6),
  card_ids: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parent_category_ids: z.string().optional(),
  child_category_ids: z.string().optional(),
  uncategorized: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validated = timeFlowQuerySchema.safeParse(params);

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
      months_back,
      months_forward,
      card_ids,
      date_from,
      date_to,
      parent_category_ids,
      child_category_ids,
      uncategorized,
    } = validated.data;

    const cardIdsArray = card_ids?.split(',').map(Number).filter(Boolean);
    const parentCategoryIdsArray = parent_category_ids?.split(',').map(Number).filter(Boolean);
    const childCategoryIdsArray = child_category_ids?.split(',').map(Number).filter(Boolean);

    const result = await queryTimeFlow({
      monthsBack: months_back,
      monthsForward: months_forward,
      cardIds: cardIdsArray,
      dateFrom: date_from,
      dateTo: date_to,
      parentCategoryIds: parentCategoryIdsArray,
      childCategoryIds: childCategoryIdsArray,
      uncategorized: uncategorized === 'true',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching time-flow data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time-flow data' },
      { status: 500 }
    );
  }
}
