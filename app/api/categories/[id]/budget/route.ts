import { NextRequest, NextResponse } from 'next/server';
import { setBudget, removeBudget, getBudgetHistory, deleteBudgetHistoryRecord, deleteAllBudgetHistory } from '@/lib/services/category-service';
import { z } from 'zod';

// ============================================
// GET /api/categories/[id]/budget
// Get budget history for category
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

    const history = await getBudgetHistory(categoryId);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching budget history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget history' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/categories/[id]/budget
// Set or update budget
// ============================================

const setBudgetSchema = z.object({
  budgetAmount: z.number().positive(),
  budgetPeriod: z.enum(['monthly', 'annual']),
  effectiveFrom: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  notes: z.string().optional(),
  backfillToEarliestTransaction: z.boolean().optional(),
});

export async function POST(
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
    const validated = setBudgetSchema.parse(body);

    const budgetHistory = await setBudget({
      categoryId,
      budgetAmount: validated.budgetAmount,
      budgetPeriod: validated.budgetPeriod,
      effectiveFrom: new Date(validated.effectiveFrom),
      notes: validated.notes,
      backfillToEarliestTransaction: validated.backfillToEarliestTransaction,
    });

    return NextResponse.json({ budgetHistory }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error setting budget:', error);
    return NextResponse.json(
      { error: 'Failed to set budget' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/categories/[id]/budget
// Remove budget (soft delete)
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

    await removeBudget(categoryId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error removing budget:', error);
    return NextResponse.json(
      { error: 'Failed to remove budget' },
      { status: 500 }
    );
  }
}
