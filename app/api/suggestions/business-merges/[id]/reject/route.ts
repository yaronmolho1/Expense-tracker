import { NextResponse } from 'next/server';
import { SuggestionService } from '@/lib/services/suggestion-service';

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

    // Execute rejection via service
    const suggestionService = new SuggestionService();
    await suggestionService.rejectMerge(suggestionId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Failed to reject merge:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject merge' },
      { status: 500 }
    );
  }
}
