import { NextResponse } from 'next/server';
import { SuggestionService } from '@/lib/services/suggestion-service';

export async function GET() {
  try {
    const suggestionService = new SuggestionService();
    const suggestions = await suggestionService.getPendingMergeSuggestions();

    // Transform for frontend
    const formatted = suggestions.map((s: any) => ({
      id: s.id,
      business_1: {
        id: s.business1?.id,
        name: s.business1?.displayName,
        normalized_name: s.business1?.normalizedName,
        primary_category_id: s.business1?.primaryCategoryId,
        child_category_id: s.business1?.childCategoryId,
      },
      business_2: {
        id: s.business2?.id,
        name: s.business2?.displayName,
        normalized_name: s.business2?.normalizedName,
        primary_category_id: s.business2?.primaryCategoryId,
        child_category_id: s.business2?.childCategoryId,
      },
      similarity_score: s.similarityScore,
      reason: s.suggestionReason,
      created_at: s.createdAt,
    }));

    return NextResponse.json({ suggestions: formatted });
  } catch (error) {
    console.error('[API] Failed to fetch merge suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merge suggestions' },
      { status: 500 }
    );
  }
}
