import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// TYPES
// ============================================

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  displayOrder: number;
  budgetAmount: string | null;
  budgetPeriod: 'monthly' | 'annual' | null;
  createdAt: string;
  children?: Category[];
}

export interface BudgetHistoryRecord {
  id: number;
  categoryId: number;
  budgetAmount: string;
  budgetPeriod: 'monthly' | 'annual';
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  notes: string | null;
}

export interface SetBudgetInput {
  budgetAmount: number;
  budgetPeriod: 'monthly' | 'annual';
  effectiveFrom: string;
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
// FETCH CATEGORIES
// ============================================

async function fetchCategories(format: 'tree' | 'flat' = 'tree'): Promise<Category[]> {
  const res = await fetch(`/api/categories?format=${format}`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.categories;
}

export function useCategories(format: 'tree' | 'flat' = 'tree') {
  return useQuery({
    queryKey: ['categories', format],
    queryFn: () => fetchCategories(format),
  });
}

// ============================================
// FETCH SINGLE CATEGORY
// ============================================

async function fetchCategory(id: number): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`);
  if (!res.ok) throw new Error('Failed to fetch category');
  const data = await res.json();
  return data.category;
}

export function useCategory(id: number) {
  return useQuery({
    queryKey: ['category', id],
    queryFn: () => fetchCategory(id),
    enabled: !!id,
  });
}

// ============================================
// CREATE CATEGORY
// ============================================

async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create category');
  }

  const data = await res.json();
  return data.category;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// ============================================
// UPDATE CATEGORY
// ============================================

async function updateCategory(id: number, input: UpdateCategoryInput): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update category');
  }

  const data = await res.json();
  return data.category;
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// ============================================
// REORDER CATEGORIES
// ============================================

async function reorderCategories(updates: Array<{ id: number; displayOrder: number }>): Promise<void> {
  const res = await fetch('/api/categories/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to reorder categories');
  }
}

export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// ============================================
// DELETE CATEGORY
// ============================================

async function deleteCategory(id: number, targetCategoryId?: number | null): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetCategoryId }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete category');
  }
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, targetCategoryId }: { id: number; targetCategoryId?: number | null }) =>
      deleteCategory(id, targetCategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// ============================================
// GET BUSINESS COUNT FOR CATEGORY
// ============================================

async function getBusinessCount(categoryId: number): Promise<number> {
  const res = await fetch(`/api/categories/${categoryId}/businesses`);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch business count');
  }

  const data = await res.json();
  return data.count;
}

export function useBusinessCount(categoryId: number) {
  return useQuery({
    queryKey: ['business-count', categoryId],
    queryFn: () => getBusinessCount(categoryId),
    enabled: !!categoryId,
  });
}

// ============================================
// SET BUDGET
// ============================================

async function setBudget(categoryId: number, input: SetBudgetInput): Promise<BudgetHistoryRecord> {
  const res = await fetch(`/api/categories/${categoryId}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to set budget');
  }

  const data = await res.json();
  return data.budgetHistory;
}

export function useSetBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: number; input: SetBudgetInput }) =>
      setBudget(categoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['budget-history'] });
    },
  });
}

// ============================================
// REMOVE BUDGET
// ============================================

async function removeBudget(categoryId: number): Promise<void> {
  const res = await fetch(`/api/categories/${categoryId}/budget`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to remove budget');
  }
}

export function useRemoveBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['budget-history'] });
    },
  });
}

// ============================================
// FETCH BUDGET HISTORY
// ============================================

async function fetchBudgetHistory(categoryId: number): Promise<BudgetHistoryRecord[]> {
  const res = await fetch(`/api/categories/${categoryId}/budget`);
  if (!res.ok) throw new Error('Failed to fetch budget history');
  const data = await res.json();
  return data.history;
}

export function useBudgetHistory(categoryId: number) {
  return useQuery({
    queryKey: ['budget-history', categoryId],
    queryFn: () => fetchBudgetHistory(categoryId),
    enabled: !!categoryId,
  });
}

// ============================================
// DELETE BUDGET HISTORY RECORD
// ============================================

async function deleteBudgetHistoryRecord(historyId: number): Promise<void> {
  const res = await fetch(`/api/categories/budget-history/${historyId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete budget history record');
  }
}

export function useDeleteBudgetHistoryRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBudgetHistoryRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['budget-history'] });
      queryClient.invalidateQueries({ queryKey: ['time-flow'] });
    },
  });
}

// ============================================
// DELETE ALL BUDGET HISTORY
// ============================================

async function deleteAllBudgetHistory(categoryId: number): Promise<void> {
  const res = await fetch(`/api/categories/${categoryId}/budget/history`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete all budget history');
  }
}

export function useDeleteAllBudgetHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAllBudgetHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['budget-history'] });
      queryClient.invalidateQueries({ queryKey: ['time-flow'] });
    },
  });
}
