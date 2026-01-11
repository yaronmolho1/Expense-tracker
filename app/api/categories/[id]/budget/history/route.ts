import { NextRequest, NextResponse } from 'next/server';
import { deleteAllBudgetHistory } from '@/lib/services/category-service';

// ============================================
// DELETE /api/categories/[id]/budget/history
// Delete all budget history for a category
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    await deleteAllBudgetHistory(categoryId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting all budget history:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget history' },
      { status: 500 }
    );
  }
}
