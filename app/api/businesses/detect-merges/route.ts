import { NextResponse } from 'next/server';
import { suggestionService } from '@/lib/services/suggestion-service';

// ============================================
// POST /api/businesses/detect-merges
// Manually trigger business merge detection
// ============================================

export async function POST() {
  try {
    const result = await suggestionService.detectBusinessMerges();

    return NextResponse.json({
      success: true,
      suggestionsCreated: result.suggestionsCreated,
      businessesCompared: result.businessesCompared,
      message: `Compared ${result.businessesCompared} business pairs and created ${result.suggestionsCreated} merge suggestions`,
    });
  } catch (error) {
    console.error('Error detecting business merges:', error);
    return NextResponse.json(
      { error: 'Failed to detect business merges' },
      { status: 500 }
    );
  }
}
