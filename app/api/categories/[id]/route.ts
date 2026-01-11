import { NextRequest, NextResponse } from 'next/server';
import { getCategoryById, updateCategory, deleteCategory, getBusinessCountForCategory } from '@/lib/services/category-service';
import { z } from 'zod';

// ============================================
// GET /api/categories/[id]
// Get single category
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

    const category = await getCategoryById(categoryId);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/categories/[id]
// Update category
// ============================================

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.number().optional(),
  displayOrder: z.number().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateCategorySchema.parse(body);

    const category = await updateCategory(categoryId, validated);

    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/categories/[id]
// Delete category with optional target category for businesses
// Query params: targetCategoryId (optional, null to uncategorize)
// ============================================

const deleteCategorySchema = z.object({
  targetCategoryId: z.number().nullable().optional(),
});

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

    const body = await request.json().catch(() => ({}));
    const validated = deleteCategorySchema.parse(body);

    await deleteCategory(categoryId, validated.targetCategoryId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
