import { NextRequest, NextResponse } from 'next/server';
import { reorderCategories } from '@/lib/services/category-service';
import { z } from 'zod';

// ============================================
// POST /api/categories/reorder
// Bulk update display orders for categories
// ============================================

const reorderSchema = z.object({
  updates: z.array(z.object({
    id: z.number(),
    displayOrder: z.number(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = reorderSchema.parse(body);

    await reorderCategories(validated.updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error reordering categories:', error);
    return NextResponse.json(
      { error: 'Failed to reorder categories' },
      { status: 500 }
    );
  }
}
