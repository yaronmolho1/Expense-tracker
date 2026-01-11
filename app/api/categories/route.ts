import { NextRequest, NextResponse } from 'next/server';
import { getAllCategories, getCategoryTree, createCategory } from '@/lib/services/category-service';
import { z } from 'zod';

// ============================================
// GET /api/categories
// Return full category tree (with budget info)
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'tree';

    if (format === 'flat') {
      const categories = await getAllCategories();
      return NextResponse.json({ categories });
    } else {
      const tree = await getCategoryTree();
      return NextResponse.json({ categories: tree });
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/categories
// Create new category
// ============================================

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.number().optional(),
  displayOrder: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createCategorySchema.parse(body);

    const category = await createCategory(validated);

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
