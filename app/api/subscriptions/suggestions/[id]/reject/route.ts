import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptionSuggestions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const suggestionId = parseInt(id);

    // Set freeze period: 30 days from now
    const freezeUntil = new Date();
    freezeUntil.setDate(freezeUntil.getDate() + 30);

    // Update suggestion status to rejected with freeze period
    const [updated] = await db
      .update(subscriptionSuggestions)
      .set({
        status: 'rejected',
        resolvedAt: new Date(),
        rejectedUntil: freezeUntil,
      })
      .where(eq(subscriptionSuggestions.id, suggestionId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Suggestion rejected',
      rejectedUntil: freezeUntil.toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error('Error rejecting subscription suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to reject suggestion' },
      { status: 500 }
    );
  }
}
