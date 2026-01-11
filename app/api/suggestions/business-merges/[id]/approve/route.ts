import { NextResponse } from 'next/server';
import { SuggestionService } from '@/lib/services/suggestion-service';
import { z } from 'zod';

// Validation schema
const ApproveSchema = z.object({
  target_id: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ requires awaiting params
    const { id } = await params;
    const suggestionId = parseInt(id, 10);

    if (isNaN(suggestionId)) {
      return NextResponse.json(
        { error: 'Invalid suggestion ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ApproveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { target_id } = validation.data;

    // Execute merge via service
    const suggestionService = new SuggestionService();
    const result = await suggestionService.approveMerge(suggestionId, target_id);

    return NextResponse.json({
      success: true,
      transactions_updated: result.transactionsUpdated,
    });
  } catch (error) {
    console.error('[API] Failed to approve merge:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve merge' },
      { status: 500 }
    );
  }
}
