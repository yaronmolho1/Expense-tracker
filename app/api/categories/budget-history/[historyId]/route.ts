import { NextRequest, NextResponse } from 'next/server';
import { deleteBudgetHistoryRecord } from '@/lib/services/category-service';

// ============================================
// DELETE /api/categories/budget-history/[historyId]
// Delete a specific budget history record
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ historyId: string }> }
) {
  try {
    const { historyId } = await params;
    const id = parseInt(historyId);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid history ID' }, { status: 400 });
    }

    await deleteBudgetHistoryRecord(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting budget history record:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget history record' },
      { status: 500 }
    );
  }
}
