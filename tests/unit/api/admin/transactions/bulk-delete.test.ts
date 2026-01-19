import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/transactions/bulk-delete/route';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      transactions: {
        findMany: vi.fn(),
      },
      subscriptions: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';

describe('Bulk Delete API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('rejects invalid request with missing required fields', async () => {
      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    test('accepts valid preview request', async () => {
      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        }),
      });

      // Mock db response
      vi.mocked(db.query.transactions.findMany).mockResolvedValue([]);

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Preview Mode Detection', () => {
    test('returns preview when installmentStrategy is not provided', async () => {
      // Setup mock data
      const mockTransactions = [
        { id: 1, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-01', chargedAmountIls: '100' },
      ];
      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTransactions as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.requiresConfirmation).toBe(true);
      expect(data.summary).toBeDefined();
    });

    test('returns preview when subscriptionStrategy is not provided', async () => {
      const mockTransactions = [
        { id: 1, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-01', chargedAmountIls: '100' },
      ];
      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTransactions as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01', installmentStrategy: 'skip_all' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.requiresConfirmation).toBe(true);
      expect(data.summary).toBeDefined();
    });
  });

  describe('Transaction Counting', () => {
    test('correctly counts one-time transactions', async () => {
      const mockTransactions = [
        { id: 1, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
        { id: 2, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-02', chargedAmountIls: '200', business: {} },
        { id: 3, transactionType: 'installment', installmentGroupId: 'abc123', subscriptionId: null, dealDate: '2024-01-03', chargedAmountIls: '300', business: {} },
      ];
      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTransactions as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.summary.oneTimeCount).toBe(2);
      expect(data.summary.installmentCount).toBe(1);
    });
  });

  describe('Installment Analysis', () => {
    test('detects partial installment groups', async () => {
      const inRangeTxs = [
        { id: 1, installmentGroupId: 'group1', installmentIndex: 1, dealDate: '2024-01-01', chargedAmountIls: '100', status: 'completed', business: { displayName: 'Test' } },
        { id: 2, installmentGroupId: 'group1', installmentIndex: 2, dealDate: '2024-02-01', chargedAmountIls: '100', status: 'completed', business: { displayName: 'Test' } },
      ];

      const allInGroup = [
        ...inRangeTxs,
        { id: 3, installmentGroupId: 'group1', installmentIndex: 3, dealDate: '2025-01-01', chargedAmountIls: '100', status: 'projected' },
        { id: 4, installmentGroupId: 'group1', installmentIndex: 4, dealDate: '2025-02-01', chargedAmountIls: '100', status: 'projected' },
      ];

      vi.mocked(db.query.transactions.findMany)
        .mockResolvedValueOnce(inRangeTxs as any) // First call for matching transactions
        .mockResolvedValueOnce(allInGroup as any); // Second call for all in group

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01', dateTo: '2024-12-31' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.partialInstallments).toHaveLength(1);
      expect(data.partialInstallments[0].inBatch).toBe(2);
      expect(data.partialInstallments[0].total).toBe(4);
    });
  });

  describe('Subscription Analysis', () => {
    test('analyzes affected subscriptions', async () => {
      const mockTxs = [
        { id: 1, subscriptionId: 100, dealDate: '2024-06-01', chargedAmountIls: '12.99', business: {} },
        { id: 2, subscriptionId: 100, dealDate: '2024-07-01', chargedAmountIls: '12.99', business: {} },
      ];

      const mockSub = {
        id: 100,
        name: 'Netflix',
        frequency: 'monthly',
        status: 'active',
        business: { displayName: 'Netflix Inc' },
      };

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue(mockSub as any);
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 5 }]), // Has future transactions
        }),
      } as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01', dateTo: '2024-12-31' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.affectedSubscriptions).toHaveLength(1);
      expect(data.affectedSubscriptions[0].continuesAfterRange).toBe(true);
      expect(data.affectedSubscriptions[0].transactionsInRange).toBe(2);
    });
  });

  describe('Deletion Execution - One-time', () => {
    test('deletes one-time transactions when includeOneTime=true', async () => {
      const mockTxs = [
        { id: 1, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
        { id: 2, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-02-01', chargedAmountIls: '200', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeOneTime: true,
          installmentStrategy: 'skip_all',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.deletedTransactions).toBe(2);
      expect(db.delete).toHaveBeenCalledTimes(2);
    });

    test('skips one-time transactions when includeOneTime=false', async () => {
      const mockTxs = [
        { id: 1, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeOneTime: false,
          installmentStrategy: 'skip_all',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(0);
    });
  });

  describe('Deletion Execution - Installments', () => {
    test('delete_all_matching_groups deletes entire groups', async () => {
      const mockTxs = [
        { id: 1, installmentGroupId: 'group1', installmentIndex: 1, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
        { id: 2, installmentGroupId: 'group1', installmentIndex: 2, dealDate: '2024-02-01', chargedAmountIls: '100', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.delete).mockReturnValue({
        where: () => ({
          returning: () => Promise.resolve([
            { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, // All 4 payments in group
          ]),
        }),
      } as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeInstallments: true,
          installmentStrategy: 'delete_all_matching_groups',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(4); // All payments deleted
    });

    test('delete_matching_only deletes only in-range payments', async () => {
      const mockTxs = [
        { id: 1, installmentGroupId: 'group1', installmentIndex: 1, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
        { id: 2, installmentGroupId: 'group1', installmentIndex: 2, dealDate: '2024-02-01', chargedAmountIls: '100', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeInstallments: true,
          installmentStrategy: 'delete_matching_only',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(2); // Only in-range deleted
    });

    test('skip_all preserves all installments', async () => {
      const mockTxs = [
        { id: 1, installmentGroupId: 'group1', installmentIndex: 1, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeInstallments: true,
          installmentStrategy: 'skip_all',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(0);
    });
  });

  describe('Deletion Execution - Subscriptions', () => {
    test('skip strategy preserves subscriptions', async () => {
      const mockTxs = [
        { id: 1, subscriptionId: 100, dealDate: '2024-06-01', chargedAmountIls: '12.99', transactionType: 'subscription', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeSubscriptions: true,
          subscriptionStrategy: 'skip',
          installmentStrategy: 'skip_all',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(0);
      expect(data.cancelledSubscriptions).toBe(0);
    });

    test('delete_in_range_and_cancel cancels subscriptions and deletes transactions', async () => {
      const mockTxs = [
        { id: 1, subscriptionId: 100, dealDate: '2024-06-01', chargedAmountIls: '12.99', transactionType: 'subscription', business: {} },
        { id: 2, subscriptionId: 100, dealDate: '2024-07-01', chargedAmountIls: '12.99', transactionType: 'subscription', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue({ id: 100 } as any);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          includeSubscriptions: true,
          subscriptionStrategy: 'delete_in_range_and_cancel',
          installmentStrategy: 'skip_all',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(2);
      expect(data.cancelledSubscriptions).toBe(1);

      // Verify subscription was updated with correct fields
      expect(db.update).toHaveBeenCalledWith(subscriptions);
      const updateCall = mockSet.mock.calls[0][0];
      expect(updateCall.status).toBe('cancelled');
      expect(updateCall.cancelledAt).toBeInstanceOf(Date);
      expect(updateCall.endDate).toBe('2024-06-01'); // Earliest transaction date
    });
  });

  describe('Edge Cases', () => {
    test('handles empty result set', async () => {
      vi.mocked(db.query.transactions.findMany).mockResolvedValue([]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.summary.totalInRange).toBe(0);
    });

    test('handles subscription not found', async () => {
      const mockTxs = [
        { id: 1, subscriptionId: 999, dealDate: '2024-01-01', chargedAmountIls: '12.99', business: {} }, // Non-existent subscription
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue(undefined);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.affectedSubscriptions).toHaveLength(0); // Should skip null subscription
    });

    test('handles multiple transaction types in one request', async () => {
      const mockTxs = [
        { id: 1, transactionType: 'one_time', installmentGroupId: null, subscriptionId: null, dealDate: '2024-01-01', chargedAmountIls: '100', business: {} },
        { id: 2, installmentGroupId: 'group1', subscriptionId: null, dealDate: '2024-01-02', chargedAmountIls: '200', business: {} },
        { id: 3, subscriptionId: 100, transactionType: 'subscription', dealDate: '2024-01-03', chargedAmountIls: '12.99', business: {} },
      ];

      vi.mocked(db.query.transactions.findMany).mockResolvedValue(mockTxs as any);
      vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue({ id: 100, business: {} } as any);
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([{ count: 0 }]),
        }),
      } as any);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ dateFrom: '2024-01-01' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.summary.oneTimeCount).toBe(1);
      expect(data.summary.installmentCount).toBe(1);
      expect(data.summary.subscriptionCount).toBe(1);
    });
  });
});
