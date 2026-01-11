import { NextRequest, NextResponse } from 'next/server';
import { getBusinessCountForCategory } from '@/lib/services/category-service';

// ============================================
// GET /api/categories/[id]/businesses
// Get business count for category
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const count = await getBusinessCountForCategory(categoryId);

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching business count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business count' },
      { status: 500 }
    );
  }
}
