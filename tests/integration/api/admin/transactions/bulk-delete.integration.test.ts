import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/transactions/bulk-delete/route';
import { db } from '@/lib/db';
import { transactions, subscriptions, businesses, cards, uploadBatches } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Integration tests for bulk delete API route
 * These tests use a real database connection and verify end-to-end functionality
 *
 * Setup required:
 * - Test database configured
 * - Database migrations applied
 * - Test data seeded before each test
 */

function createTransactionHash(businessId: number, dealDate: string, amount: string, index = 0): string {
  return crypto
    .createHash('sha256')
    .update(`${businessId}-${dealDate}-${amount}-${index}-${Date.now()}`)
    .digest('hex');
}

interface CreateTransactionParams {
  businessId: number;
  cardId: number;
  uploadBatchId: number;
  dealDate: string;
  amount: string;
  transactionType?: 'one_time' | 'installment' | 'subscription';
  installmentGroupId?: string;
  installmentIndex?: number;
  installmentTotal?: number;
  subscriptionId?: number;
  status?: 'completed' | 'projected' | 'cancelled';
  index?: number;
}

function createTransaction(params: CreateTransactionParams) {
  const {
    businessId,
    cardId,
    uploadBatchId,
    dealDate,
    amount,
    transactionType = 'one_time',
    installmentGroupId,
    installmentIndex,
    installmentTotal,
    subscriptionId,
    status = 'completed',
    index = 0,
  } = params;

  return {
    transactionHash: createTransactionHash(businessId, dealDate, amount, index),
    businessId,
    cardId,
    dealDate,
    originalAmount: amount,
    originalCurrency: 'ILS',
    chargedAmountIls: amount,
    transactionType,
    paymentType: installmentGroupId ? 'installments' : 'one_time',
    status,
    sourceFile: 'test-data.csv',
    uploadBatchId,
    installmentGroupId,
    installmentIndex,
    installmentTotal,
    installmentAmount: installmentGroupId ? amount : undefined,
    subscriptionId,
  };
}

describe('Bulk Delete Integration Tests', () => {
  let testBusiness: any;
  let testCard: any;
  let testBatch: any;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(transactions).execute();
    await db.delete(subscriptions).execute();
    await db.delete(businesses).execute();
    await db.delete(cards).execute();
    await db.delete(uploadBatches).execute();

    // Create test business and card
    [testBusiness] = await db
      .insert(businesses)
      .values({
        normalizedName: 'test-business',
        displayName: 'Test Business',
      })
      .returning();

    [testCard] = await db
      .insert(cards)
      .values({
        last4Digits: '1234',
        nickname: 'Test Card',
        fileFormatHandler: 'test-handler',
        owner: 'test-owner',
      })
      .returning();

    [testBatch] = await db
      .insert(uploadBatches)
      .values({
        fileCount: 1,
        status: 'completed',
      })
      .returning();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(transactions).execute();
    await db.delete(subscriptions).execute();
    await db.delete(businesses).execute();
    await db.delete(cards).execute();
    await db.delete(uploadBatches).execute();
  });

  describe('End-to-End Preview Flow', () => {
    test('full preview flow with real database', async () => {
      // Seed test data
      await db.insert(transactions).values([
        createTransaction({
          businessId: testBusiness.id,
          cardId: testCard.id,
          uploadBatchId: testBatch.id,
          dealDate: '2024-06-01',
          amount: '100.00',
          index: 0,
        }),
        createTransaction({
          businessId: testBusiness.id,
          cardId: testCard.id,
          uploadBatchId: testBatch.id,
          dealDate: '2024-07-01',
          amount: '50.00',
          transactionType: 'installment',
          installmentGroupId: 'group1',
          installmentIndex: 1,
          installmentTotal: 2,
          index: 1,
        }),
        createTransaction({
          businessId: testBusiness.id,
          cardId: testCard.id,
          uploadBatchId: testBatch.id,
          dealDate: '2024-08-01',
          amount: '50.00',
          transactionType: 'installment',
          installmentGroupId: 'group1',
          installmentIndex: 2,
          installmentTotal: 2,
          index: 2,
        }),
      ]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.requiresConfirmation).toBe(true);
      expect(data.summary.totalInRange).toBe(3);
      expect(data.summary.oneTimeCount).toBe(1);
      expect(data.summary.installmentCount).toBe(2);

      // Verify no data was deleted
      const count = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions);
      expect(Number(count[0].count)).toBe(3);
    });
  });

  describe('End-to-End Deletion Flow', () => {
    test('full deletion flow deletes correct transactions', async () => {
      // Seed data
      const [tx1, tx2, tx3] = await db
        .insert(transactions)
        .values([
          {
            businessId: testBusiness.id,
            cardId: testCard.id,
            dealDate: '2024-06-01',
            chargedAmountIls: '100.00',
            transactionType: 'one_time',
          },
          {
            businessId: testBusiness.id,
            cardId: testCard.id,
            dealDate: '2024-07-01',
            chargedAmountIls: '200.00',
            transactionType: 'one_time',
          },
          {
            businessId: testBusiness.id,
            cardId: testCard.id,
            dealDate: '2025-01-01',
            chargedAmountIls: '300.00',
            transactionType: 'one_time',
          },
        ])
        .returning();

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          includeOneTime: true,
          installmentStrategy: 'skip_all',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.deletedTransactions).toBe(2);

      // Verify correct transactions were deleted
      const remaining = await db.select().from(transactions);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(tx3.id); // Outside range preserved
    });
  });

  describe('Installment Group Integrity', () => {
    test('delete_all_matching_groups removes entire group across date ranges', async () => {
      // Create installment group with payments spanning multiple months
      const groupId = 'test-group-123';

      await db.insert(transactions).values([
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-06-01',
          installmentGroupId: groupId,
          installmentIndex: 1,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-07-01',
          installmentGroupId: groupId,
          installmentIndex: 2,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2025-01-01',
          installmentGroupId: groupId,
          installmentIndex: 3,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2025-02-01',
          installmentGroupId: groupId,
          installmentIndex: 4,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
      ]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          includeInstallments: true,
          installmentStrategy: 'delete_all_matching_groups',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(4); // All 4 payments deleted

      // Verify no transactions remain for this group
      const remaining = await db
        .select()
        .from(transactions)
        .where(eq(transactions.installmentGroupId, groupId));
      expect(remaining).toHaveLength(0);
    });

    test('delete_matching_only deletes only payments in range', async () => {
      const groupId = 'test-group-456';

      await db.insert(transactions).values([
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-06-01',
          installmentGroupId: groupId,
          installmentIndex: 1,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-07-01',
          installmentGroupId: groupId,
          installmentIndex: 2,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2025-01-01',
          installmentGroupId: groupId,
          installmentIndex: 3,
          installmentCount: 4,
          chargedAmountIls: '100.00',
        },
      ]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          includeInstallments: true,
          installmentStrategy: 'delete_matching_only',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.deletedTransactions).toBe(2); // Only 2024 payments deleted

      // Verify 2025 payment remains
      const remaining = await db
        .select()
        .from(transactions)
        .where(eq(transactions.installmentGroupId, groupId));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].dealDate).toBe('2025-01-01');
    });
  });

  describe('Subscription Cancellation', () => {
    test('subscription cancellation updates status and endDate correctly', async () => {
      // Create subscription
      const [sub] = await db
        .insert(subscriptions)
        .values({
          businessId: testBusiness.id,
          cardId: testCard.id,
          amount: '9.99',
          frequency: 'monthly',
          startDate: '2024-01-01',
          status: 'active',
        })
        .returning();

      // Create subscription transactions
      await db.insert(transactions).values([
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          subscriptionId: sub.id,
          dealDate: '2024-06-01',
          chargedAmountIls: '9.99',
          transactionType: 'subscription',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          subscriptionId: sub.id,
          dealDate: '2024-07-01',
          chargedAmountIls: '9.99',
          transactionType: 'subscription',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          subscriptionId: sub.id,
          dealDate: '2024-08-01',
          chargedAmountIls: '9.99',
          transactionType: 'subscription',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          subscriptionId: sub.id,
          dealDate: '2025-01-01',
          chargedAmountIls: '9.99',
          transactionType: 'subscription',
        },
      ]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-08-01',
          dateTo: '2024-12-31',
          includeSubscriptions: true,
          subscriptionStrategy: 'delete_in_range_and_cancel',
          installmentStrategy: 'skip_all',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.cancelledSubscriptions).toBe(1);
      expect(data.deletedTransactions).toBe(1); // Only 2024-08-01

      // Verify subscription was updated
      const updatedSub = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, sub.id));
      expect(updatedSub[0].status).toBe('cancelled');
      expect(updatedSub[0].endDate).toBe('2024-08-01'); // Earliest deleted date
      expect(updatedSub[0].cancelledAt).toBeInstanceOf(Date);

      // Verify only in-range transactions deleted
      const remainingTxs = await db
        .select()
        .from(transactions)
        .where(eq(transactions.subscriptionId, sub.id));
      expect(remainingTxs).toHaveLength(3); // 2024-06, 2024-07, 2025-01 remain
    });
  });

  describe('Card Filtering', () => {
    test('filters transactions by card IDs', async () => {
      const [card2] = await db
        .insert(cards)
        .values({
          last4: '5678',
          nickname: 'Card 2',
          institutionId: 1,
          institutionName: 'Test Bank',
        })
        .returning();

      const [card3] = await db
        .insert(cards)
        .values({
          last4: '9012',
          nickname: 'Card 3',
          institutionId: 1,
          institutionName: 'Test Bank',
        })
        .returning();

      await db.insert(transactions).values([
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-06-01',
          chargedAmountIls: '100.00',
        },
        {
          businessId: testBusiness.id,
          cardId: card2.id,
          dealDate: '2024-06-01',
          chargedAmountIls: '200.00',
        },
        {
          businessId: testBusiness.id,
          cardId: card3.id,
          dealDate: '2024-06-01',
          chargedAmountIls: '300.00',
        },
      ]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          cardIds: [testCard.id, card2.id], // Only cards 1 and 2
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.summary.totalInRange).toBe(2); // Card 3 excluded
    });
  });

  describe('Complex Scenarios', () => {
    test('handles mixed transaction types with different strategies', async () => {
      // Create subscription
      const [sub] = await db
        .insert(subscriptions)
        .values({
          businessId: testBusiness.id,
          cardId: testCard.id,
          amount: '12.99',
          frequency: 'monthly',
          startDate: '2024-01-01',
          status: 'active',
        })
        .returning();

      // Insert mixed transactions
      await db.insert(transactions).values([
        // One-time
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-06-01',
          chargedAmountIls: '100.00',
          transactionType: 'one_time',
        },
        // Installment group
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-07-01',
          installmentGroupId: 'group1',
          installmentIndex: 1,
          installmentCount: 2,
          chargedAmountIls: '50.00',
        },
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          dealDate: '2024-08-01',
          installmentGroupId: 'group1',
          installmentIndex: 2,
          installmentCount: 2,
          chargedAmountIls: '50.00',
        },
        // Subscription
        {
          businessId: testBusiness.id,
          cardId: testCard.id,
          subscriptionId: sub.id,
          dealDate: '2024-09-01',
          chargedAmountIls: '12.99',
          transactionType: 'subscription',
        },
      ]);

      const req = new NextRequest('http://localhost/api/admin/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          includeOneTime: true,
          includeInstallments: true,
          includeSubscriptions: false, // Don't delete subscription
          installmentStrategy: 'delete_all_matching_groups',
          subscriptionStrategy: 'skip',
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.deletedTransactions).toBe(3); // 1 one-time + 2 installments

      // Verify subscription transaction remains
      const remaining = await db.select().from(transactions);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].subscriptionId).toBe(sub.id);
    });
  });
});
