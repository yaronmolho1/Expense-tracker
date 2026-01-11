import { NextResponse } from 'next/server';
import { SubscriptionDetectionService } from '@/lib/services/subscription-detection-service';

// ============================================
// POST /api/subscriptions/detect
// Manually trigger subscription detection
// ============================================

export async function POST() {
  try {
    const detectionService = new SubscriptionDetectionService();
    const result = await detectionService.detectSubscriptions();

    return NextResponse.json({
      success: true,
      suggestionsCreated: result.suggestionsCreated,
      patternsAnalyzed: result.patternsAnalyzed,
      message: `Analyzed ${result.patternsAnalyzed} patterns and created ${result.suggestionsCreated} suggestions`,
    });
  } catch (error) {
    console.error('Error detecting subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to detect subscriptions' },
      { status: 500 }
    );
  }
}
