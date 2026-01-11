import { db } from '@/lib/db';
import { categories, categoryBudgetHistory } from '@/lib/db/schema';
import { eq, and, gte, lte, isNull, or, sql, desc } from 'drizzle-orm';

// ============================================
// TYPES
// ============================================

export interface CategoryWithBudget {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  displayOrder: number;
  budgetAmount: string | null;
  budgetPeriod: 'monthly' | 'annual' | null;
  createdAt: Date;
}

export interface BudgetHistoryRecord {
  id: number;
  categoryId: number;
  budgetAmount: string;
  budgetPeriod: 'monthly' | 'annual';
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: Date;
  notes: string | null;
}

export interface SetBudgetInput {
  categoryId: number;
  budgetAmount: number;
  budgetPeriod: 'monthly' | 'annual';
  effectiveFrom: Date;
  notes?: string;
  backfillToEarliestTransaction?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  parentId?: number;
  displayOrder: number;
}

export interface UpdateCategoryInput {
  name?: string;
  parentId?: number;
  displayOrder?: number;
}

// ============================================
// CATEGORY CRUD
// ============================================

/**
 * Get all categories as a flat list
 */
export async function getAllCategories(): Promise<CategoryWithBudget[]> {
  return await db
    .select()
    .from(categories)
    .orderBy(categories.level, categories.displayOrder);
}

/**
 * Get category tree (parents with children)
 */
export async function getCategoryTree() {
  const allCategories = await getAllCategories();

  const parents = allCategories.filter(c => c.level === 0);
  const children = allCategories.filter(c => c.level === 1);

  return parents.map(parent => ({
    ...parent,
    children: children.filter(child => child.parentId === parent.id)
  }));
}

/**
 * Get single category by ID
 */
export async function getCategoryById(id: number): Promise<CategoryWithBudget | null> {
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Create new category
 */
export async function createCategory(input: CreateCategoryInput): Promise<CategoryWithBudget> {
  const level = input.parentId ? 1 : 0;

  const result = await db
    .insert(categories)
    .values({
      name: input.name,
      parentId: input.parentId || null,
      level,
      displayOrder: input.displayOrder,
    })
    .returning();

  return result[0];
}

/**
 * Update category
 */
export async function updateCategory(id: number, input: UpdateCategoryInput): Promise<CategoryWithBudget> {
  const updates: any = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.displayOrder !== undefined) updates.displayOrder = input.displayOrder;

  // If parent changes, recalculate level
  if (input.parentId !== undefined) {
    updates.parentId = input.parentId || null;
    updates.level = input.parentId ? 1 : 0;
  }

  const result = await db
    .update(categories)
    .set(updates)
    .where(eq(categories.id, id))
    .returning();

  return result[0];
}

/**
 * Get count of businesses using a category
 */
export async function getBusinessCountForCategory(categoryId: number): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count
    FROM businesses
    WHERE primary_category_id = ${categoryId} OR child_category_id = ${categoryId}
  `);

  return Number((result[0] as any).count);
}

/**
 * Reorder categories by updating their display orders
 * Accepts an array of { id, displayOrder } pairs
 */
export async function reorderCategories(
  updates: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  // Update each category's displayOrder in a transaction-like manner
  for (const update of updates) {
    await db
      .update(categories)
      .set({ displayOrder: update.displayOrder })
      .where(eq(categories.id, update.id));
  }
}

/**
 * Delete category with option to move businesses to another category or uncategorize
 */
export async function deleteCategory(
  id: number,
  targetCategoryId?: number | null
): Promise<void> {
  // Check if category has children
  const childCount = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM categories WHERE parent_id = ${id}
  `);

  if (Number((childCount[0] as any).count) > 0) {
    throw new Error('Cannot delete category with children');
  }

  // Delete all budget history for this category (cascade)
  await db.delete(categoryBudgetHistory).where(eq(categoryBudgetHistory.categoryId, id));

  // Handle businesses
  if (targetCategoryId === null || targetCategoryId === undefined) {
    // Uncategorize: set both to null
    await db.execute(sql`
      UPDATE businesses
      SET child_category_id = NULL,
          primary_category_id = NULL
      WHERE primary_category_id = ${id} OR child_category_id = ${id}
    `);
  } else {
    // Get the target category to find its parent
    const targetCategory = await getCategoryById(targetCategoryId);
    if (!targetCategory) {
      throw new Error('Target category not found');
    }

    // Move to target category with proper parent/child relationship
    await db.execute(sql`
      UPDATE businesses
      SET child_category_id = ${targetCategoryId},
          primary_category_id = ${targetCategory.parentId}
      WHERE primary_category_id = ${id} OR child_category_id = ${id}
    `);
  }

  await db.delete(categories).where(eq(categories.id, id));
}

// ============================================
// BUDGET MANAGEMENT
// ============================================

/**
 * Set or update budget for a category
 * Handles budget history tracking with effective date ranges
 */
export async function setBudget(input: SetBudgetInput): Promise<BudgetHistoryRecord> {
  let effectiveFrom = input.effectiveFrom;

  // If backfill requested, find earliest transaction for this category
  if (input.backfillToEarliestTransaction) {
    const earliestTx = await db.execute<{ earliest_date: string | null }>(sql`
      SELECT MIN(COALESCE(t.actual_charge_date, t.projected_charge_date, t.bank_charge_date, t.deal_date)) as earliest_date
      FROM transactions t
      JOIN businesses b ON t.business_id = b.id
      WHERE b.child_category_id = ${input.categoryId}
         OR b.primary_category_id = ${input.categoryId}
    `);

    const earliestDate = earliestTx[0]?.earliest_date;
    if (earliestDate) {
      effectiveFrom = new Date(earliestDate);
    }
  }

  // Normalize effective_from based on budget period
  const normalizedEffectiveFrom = normalizeBudgetDate(effectiveFrom, input.budgetPeriod);

  // Find any overlapping active budget
  const overlappingBudget = await db
    .select()
    .from(categoryBudgetHistory)
    .where(
      and(
        eq(categoryBudgetHistory.categoryId, input.categoryId),
        lte(categoryBudgetHistory.effectiveFrom, normalizedEffectiveFrom.toISOString().split('T')[0]),
        isNull(categoryBudgetHistory.effectiveTo)
      )
    )
    .limit(1);

  // If overlapping budget exists, update its effective_to
  if (overlappingBudget.length > 0) {
    const dayBefore = new Date(normalizedEffectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);

    await db
      .update(categoryBudgetHistory)
      .set({ effectiveTo: dayBefore.toISOString().split('T')[0] })
      .where(eq(categoryBudgetHistory.id, overlappingBudget[0].id));
  }

  // Insert new budget history record
  const newBudgetHistory = await db
    .insert(categoryBudgetHistory)
    .values({
      categoryId: input.categoryId,
      budgetAmount: input.budgetAmount.toFixed(2),
      budgetPeriod: input.budgetPeriod,
      effectiveFrom: normalizedEffectiveFrom.toISOString().split('T')[0],
      effectiveTo: null, // Active budget
      notes: input.notes || null,
    })
    .returning();

  // Update denormalized budget in categories table
  await db
    .update(categories)
    .set({
      budgetAmount: input.budgetAmount.toFixed(2),
      budgetPeriod: input.budgetPeriod,
    })
    .where(eq(categories.id, input.categoryId));

  return newBudgetHistory[0];
}

/**
 * Remove budget from category (soft delete - sets effective_to to today)
 */
export async function removeBudget(categoryId: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Set effective_to on active budget
  await db
    .update(categoryBudgetHistory)
    .set({ effectiveTo: today })
    .where(
      and(
        eq(categoryBudgetHistory.categoryId, categoryId),
        isNull(categoryBudgetHistory.effectiveTo)
      )
    );

  // Clear denormalized budget
  await db
    .update(categories)
    .set({
      budgetAmount: null,
      budgetPeriod: null,
    })
    .where(eq(categories.id, categoryId));
}

/**
 * Get budget history for a category
 */
export async function getBudgetHistory(categoryId: number): Promise<BudgetHistoryRecord[]> {
  return await db
    .select()
    .from(categoryBudgetHistory)
    .where(eq(categoryBudgetHistory.categoryId, categoryId))
    .orderBy(desc(categoryBudgetHistory.effectiveFrom));
}

/**
 * Get applicable budget for a category on a specific date
 */
export async function getBudgetForDate(categoryId: number, date: Date): Promise<BudgetHistoryRecord | null> {
  const dateStr = date.toISOString().split('T')[0];

  const result = await db
    .select()
    .from(categoryBudgetHistory)
    .where(
      and(
        eq(categoryBudgetHistory.categoryId, categoryId),
        lte(categoryBudgetHistory.effectiveFrom, dateStr),
        or(
          isNull(categoryBudgetHistory.effectiveTo),
          gte(categoryBudgetHistory.effectiveTo, dateStr)
        )
      )
    )
    .orderBy(desc(categoryBudgetHistory.effectiveFrom))
    .limit(1);

  return result[0] || null;
}

/**
 * Get budgets for a month (for Time-Flow table)
 * Returns map of categoryId -> budget info
 */
export async function getBudgetsForMonth(year: number, month: number): Promise<Map<number, BudgetHistoryRecord>> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const firstDayStr = firstDay.toISOString().split('T')[0];
  const lastDayStr = lastDay.toISOString().split('T')[0];

  // Get all budgets that overlap with this month
  const budgets = await db
    .select()
    .from(categoryBudgetHistory)
    .where(
      and(
        lte(categoryBudgetHistory.effectiveFrom, lastDayStr),
        or(
          isNull(categoryBudgetHistory.effectiveTo),
          gte(categoryBudgetHistory.effectiveTo, firstDayStr)
        )
      )
    )
    .orderBy(desc(categoryBudgetHistory.effectiveFrom));

  // Build map: use the budget with the latest effectiveFrom that starts on or before this month
  const budgetMap = new Map<number, BudgetHistoryRecord>();

  budgets.forEach(budget => {
    const existing = budgetMap.get(budget.categoryId);
    // Only set if not already set (since we're ordered by effectiveFrom DESC)
    // This ensures we get the most recent budget that applies to this month
    if (!existing) {
      budgetMap.set(budget.categoryId, budget);
    }
  });

  return budgetMap;
}

/**
 * Delete a specific budget history record
 */
export async function deleteBudgetHistoryRecord(historyId: number): Promise<void> {
  // Get the record first to know which category it belongs to
  const record = await db
    .select()
    .from(categoryBudgetHistory)
    .where(eq(categoryBudgetHistory.id, historyId))
    .limit(1);

  if (record.length === 0) {
    throw new Error('Budget history record not found');
  }

  const categoryId = record[0].categoryId;

  // Delete the record
  await db.delete(categoryBudgetHistory).where(eq(categoryBudgetHistory.id, historyId));

  // Find the most recent budget (active OR historical) for this category
  const latestBudget = await db
    .select()
    .from(categoryBudgetHistory)
    .where(eq(categoryBudgetHistory.categoryId, categoryId))
    .orderBy(desc(categoryBudgetHistory.effectiveFrom))
    .limit(1);

  // Update denormalized budget in categories table
  if (latestBudget.length > 0) {
    // Set to the most recent budget (whether active or not)
    await db
      .update(categories)
      .set({
        budgetAmount: latestBudget[0].budgetAmount,
        budgetPeriod: latestBudget[0].budgetPeriod,
      })
      .where(eq(categories.id, categoryId));
  } else {
    // No more budgets at all
    await db
      .update(categories)
      .set({
        budgetAmount: null,
        budgetPeriod: null,
      })
      .where(eq(categories.id, categoryId));
  }
}

/**
 * Delete ALL budget history for a category (including active budgets)
 */
export async function deleteAllBudgetHistory(categoryId: number): Promise<void> {
  // Delete all history records
  await db.delete(categoryBudgetHistory).where(eq(categoryBudgetHistory.categoryId, categoryId));

  // Clear denormalized budget
  await db
    .update(categories)
    .set({
      budgetAmount: null,
      budgetPeriod: null,
    })
    .where(eq(categories.id, categoryId));
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalize budget effective date based on period
 * Monthly: First day of month (e.g., 2025-03-15 → 2025-03-01)
 * Annual: First day of year (e.g., 2025-03-15 → 2025-01-01)
 */
function normalizeBudgetDate(date: Date, period: 'monthly' | 'annual'): Date {
  if (period === 'monthly') {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  } else {
    return new Date(date.getFullYear(), 0, 1);
  }
}
