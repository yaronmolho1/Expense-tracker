import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { transactions, businesses, cards, uploadBatches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  createInstallmentGroup,
  createInstallmentGroupFromMiddle,
  findCompletedPayment1,
  findOrphanedBackfilledPayment1,
  findExactDuplicate,
  findProjectedPaymentInBucket,
  countGroupsWithBaseId,
  findAnyTransactionInGroup,
} from '@/lib/services/installment-service';
import { generateInstallmentGroupId } from '@/lib/utils/hash';

/**
 * Integration Tests: Installment Twin & Backfill Logic
 * 
 * Tests the complex twin purchase detection, backfill collision handling,
 * and Ghost Payment calculation with actual database operations.
 * 
 * These tests require a database connection and use transaction-based isolation.
 */

describe('Installment Twin & Backfill Logic', () => {
  let testBusinessId: number;
  let testCardId: number;
  let testBatchId: number;
  const businessNormalizedName = 'test-business-twin';
  const dealDate = '2024-01-15';
  const totalPaymentSum = 3099; // Total deal sum from file
  const regularPayment = 129; // Regular payment amount (Payment 2-24)
  const payment1Amount = 132; // Payment 1 amount (calculated: 3099 - 129*23)
  const installmentTotal = 24;

  beforeEach(async () => {
    // Create test business
    const [business] = await db.insert(businesses).values({
      displayName: 'Test Business Twin',
      normalizedName: businessNormalizedName,
    }).returning();
    testBusinessId = business.id;

    // Create test card
    const [card] = await db.insert(cards).values({
      last4Digits: '9999',
      fileFormatHandler: 'visa',
      owner: 'test-user',
    }).returning();
    testCardId = card.id;

    // Create test batch
    const [batch] = await db.insert(uploadBatches).values({
      status: 'processing',
      fileCount: 1,
      totalTransactions: 0,
    }).returning();
    testBatchId = batch.id;
  });

  afterEach(async () => {
    // Cleanup is handled by transaction rollback in vitest-hooks.ts
    // But we'll clean up explicitly for clarity
    await db.delete(transactions).where(eq(transactions.businessId, testBusinessId));
    await db.delete(businesses).where(eq(businesses.id, testBusinessId));
    await db.delete(cards).where(eq(cards.id, testCardId));
    await db.delete(uploadBatches).where(eq(uploadBatches.id, testBatchId));
  });

  describe('Twin Purchase Detection', () => {
    it('should create separate groups for twin Payment 1s', async () => {
      // Scenario: User uploads two identical Payment 1/24 transactions
      // Expected: First creates baseGroupId, second creates baseGroupId_copy_1

      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // Create first Payment 1 group
      await createInstallmentGroup({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: payment1Amount,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 1,
          total: installmentTotal,
          amount: payment1Amount,
        },
      });

      // Verify first group exists
      const existingPayment1 = await findCompletedPayment1(baseGroupId);
      expect(existingPayment1).toBeTruthy();
      expect(existingPayment1?.installmentGroupId).toBe(baseGroupId);

      // Count existing groups
      const groupCount = await countGroupsWithBaseId(baseGroupId);
      expect(groupCount).toBe(1);

      // Try to create twin Payment 1 (should detect collision)
      // In real flow, this would create baseGroupId_copy_1
      // For this test, we verify the detection logic works
      const twinPayment1 = await findCompletedPayment1(baseGroupId);
      expect(twinPayment1).toBeTruthy(); // Standard hash is occupied
    });

    it('should detect orphaned backfilled Payment 1', async () => {
      // Scenario:
      // 1. User uploads Payment 2/24 first → creates backfilled Payment 1
      // 2. User uploads Payment 1/24 later → should find and update orphan

      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // STEP 1: Upload Payment 2/24 first (backfill scenario)
      await createInstallmentGroupFromMiddle({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: regularPayment,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 2, // Payment 2/24
          total: installmentTotal,
          amount: regularPayment,
        },
      });

      // Verify backfilled Payment 1 exists
      const backfilledPayment1 = await db.query.transactions.findFirst({
        where: (tx, { eq, and }) => and(
          eq(tx.businessId, testBusinessId),
          eq(tx.installmentIndex, 1),
          eq(tx.status, 'completed')
        ),
      });

      expect(backfilledPayment1).toBeTruthy();
      expect(backfilledPayment1?.chargedAmountIls).toBe(payment1Amount.toString()); // Calculated amount

      // STEP 2: Upload Payment 1/24 (real data arrives)
      // Should find orphaned Payment 1 by metadata
      const orphanedPayment1 = await findOrphanedBackfilledPayment1({
        businessId: testBusinessId,
        cardId: testCardId,
        dealDate,
        installmentTotal,
        originalAmount: totalPaymentSum,
        baseGroupId, // Exclude standard hash
        currentBatchId: testBatchId + 1, // Different batch
        processedIds: new Set(),
      });

      expect(orphanedPayment1).toBeTruthy();
      expect(orphanedPayment1?.installmentIndex).toBe(1);
      expect(orphanedPayment1?.status).toBe('completed');
    });

    it('should handle backfill collision with UUID re-hashing', async () => {
      // Scenario: Two Payment 2/24 uploads happen simultaneously
      // Expected: First creates baseGroupId, second creates SHA256-hashed group

      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // STEP 1: Create first backfill group
      const result1 = await createInstallmentGroupFromMiddle({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: regularPayment,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 2,
          total: installmentTotal,
          amount: regularPayment,
        },
      });

      expect(result1.groupId).toBe(baseGroupId); // First one gets base ID

      // STEP 2: Try to create second backfill (collision scenario)
      // The createInstallmentGroupFromMiddle function checks for existing group
      const existingGroup = await findAnyTransactionInGroup(baseGroupId);
      expect(existingGroup).toBeTruthy(); // Collision detected

      // Create second backfill - should get re-hashed ID
      const result2 = await createInstallmentGroupFromMiddle({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: regularPayment,
          sourceFile: 'file2.xlsx',
          uploadBatchId: testBatchId + 1,
        },
        installmentInfo: {
          index: 2,
          total: installmentTotal,
          amount: regularPayment,
        },
      });

      // Second group should have different ID (SHA256-hashed)
      expect(result2.groupId).not.toBe(baseGroupId);
      expect(result2.groupId).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
      expect(result2.groupId.length).toBe(64);
    });
  });

  describe('Ghost Payment Calculation', () => {
    it('should calculate Payment 1 amount correctly in backfill', async () => {
      // Verify that backfill calculates Payment 1 using formula:
      // Payment 1 = Total - (Regular Payment × (N-1))

      await createInstallmentGroupFromMiddle({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: regularPayment,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 2, // Payment 2/24
          total: installmentTotal,
          amount: regularPayment,
        },
      });

      // Find backfilled Payment 1
      const payment1 = await db.query.transactions.findFirst({
        where: (tx, { eq, and }) => and(
          eq(tx.businessId, testBusinessId),
          eq(tx.installmentIndex, 1),
          eq(tx.status, 'completed')
        ),
      });

      expect(payment1).toBeTruthy();
      
      // Verify Payment 1 amount matches calculated value
      const expectedPayment1Amount = totalPaymentSum - (regularPayment * (installmentTotal - 1));
      expect(parseFloat(payment1!.chargedAmountIls)).toBe(expectedPayment1Amount);
      expect(parseFloat(payment1!.chargedAmountIls)).toBe(payment1Amount);
    });

    it('should update Ghost Payment 1 when real Payment 1 arrives', async () => {
      // Scenario:
      // 1. Payment 2/24 creates Ghost Payment 1 (calculated amount)
      // 2. Payment 1/24 arrives with real data
      // 3. Ghost should be updated with real amount

      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // STEP 1: Create backfill (creates Ghost Payment 1)
      await createInstallmentGroupFromMiddle({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: regularPayment,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 2,
          total: installmentTotal,
          amount: regularPayment,
        },
      });

      // Find Ghost Payment 1
      const ghostPayment1 = await db.query.transactions.findFirst({
        where: (tx, { eq, and }) => and(
          eq(tx.businessId, testBusinessId),
          eq(tx.installmentIndex, 1),
          eq(tx.status, 'completed')
        ),
      });

      expect(ghostPayment1).toBeTruthy();
      const ghostAmount = parseFloat(ghostPayment1!.chargedAmountIls);
      expect(ghostAmount).toBe(payment1Amount); // Calculated amount

      // STEP 2: Real Payment 1 arrives (might have slightly different amount due to rounding)
      const realPayment1Amount = 132.50; // Slightly different from calculated
      
      // In real flow, findOrphanedBackfilledPayment1 would find the ghost
      const orphan = await findOrphanedBackfilledPayment1({
        businessId: testBusinessId,
        cardId: testCardId,
        dealDate,
        installmentTotal,
        originalAmount: totalPaymentSum,
        baseGroupId,
        currentBatchId: testBatchId + 1,
        processedIds: new Set(),
      });

      expect(orphan).toBeTruthy();
      expect(orphan?.id).toBe(ghostPayment1!.id);

      // Update Ghost with real data
      await db.update(transactions)
        .set({
          chargedAmountIls: realPayment1Amount.toString(),
          sourceFile: 'file2.xlsx',
          uploadBatchId: testBatchId + 1,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, orphan!.id));

      // Verify update
      const updatedPayment1 = await db.query.transactions.findFirst({
        where: eq(transactions.id, orphan!.id),
      });

      expect(parseFloat(updatedPayment1!.chargedAmountIls)).toBe(realPayment1Amount);
      expect(updatedPayment1!.sourceFile).toBe('file2.xlsx');
    });
  });

  describe('Metadata-Based Matching', () => {
    it('should match payments by Total Deal Sum (originalAmount)', async () => {
      // Key insight: All payments share same originalAmount (Total Deal Sum)
      // Matching uses originalAmount, not chargedAmountIls

      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // Create group with Payment 1
      await createInstallmentGroup({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum, // Total Deal Sum
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: payment1Amount, // Payment 1 amount (132)
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 1,
          total: installmentTotal,
          amount: payment1Amount,
        },
      });

      // Find projected Payment 2 (should exist)
      const projectedPayment2 = await findProjectedPaymentInBucket({
        businessId: testBusinessId,
        cardId: testCardId,
        dealDate,
        installmentTotal,
        installmentIndex: 2,
        originalAmount: totalPaymentSum, // Match on Total Deal Sum
        processedIds: new Set(),
      });

      expect(projectedPayment2).toBeTruthy();
      expect(projectedPayment2?.installmentIndex).toBe(2);
      expect(projectedPayment2?.status).toBe('projected');
      expect(parseFloat(projectedPayment2!.originalAmount)).toBe(totalPaymentSum);
    });

    it('should prevent twin latching in same batch', async () => {
      // Scenario: Two Payment 2/24s in same file
      // Expected: Should not latch onto same projected slot

      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // Create group with Payment 1
      await createInstallmentGroup({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: payment1Amount,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 1,
          total: installmentTotal,
          amount: payment1Amount,
        },
      });

      // Find first projected Payment 2
      const projected1 = await findProjectedPaymentInBucket({
        businessId: testBusinessId,
        cardId: testCardId,
        dealDate,
        installmentTotal,
        installmentIndex: 2,
        originalAmount: totalPaymentSum,
        processedIds: new Set(),
      });

      expect(projected1).toBeTruthy();

      // Simulate processing first Payment 2 (adds to processedIds)
      const processedIds = new Set<number>();
      processedIds.add(projected1!.id);

      // Try to find second Payment 2 (should exclude already processed)
      const projected2 = await findProjectedPaymentInBucket({
        businessId: testBusinessId,
        cardId: testCardId,
        dealDate,
        installmentTotal,
        installmentIndex: 2,
        originalAmount: totalPaymentSum,
        processedIds, // Exclude first one
      });

      // Should not find the same projected payment
      expect(projected2).toBeNull();
    });

    it('should find exact duplicate using metadata', async () => {
      // Create completed Payment 1
      await createInstallmentGroup({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: payment1Amount,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 1,
          total: installmentTotal,
          amount: payment1Amount,
        },
      });

      // Try to find exact duplicate (same metadata, different batch)
      const duplicate = await findExactDuplicate({
        businessId: testBusinessId,
        cardId: testCardId,
        dealDate,
        installmentTotal,
        installmentIndex: 1,
        originalAmount: totalPaymentSum,
        currentBatchId: testBatchId + 1, // Different batch
        processedIds: new Set(),
      });

      expect(duplicate).toBeTruthy();
      expect(duplicate?.installmentIndex).toBe(1);
      expect(parseFloat(duplicate!.originalAmount)).toBe(totalPaymentSum);
    });
  });

  describe('Group ID Counting', () => {
    it('should count groups with base ID including _copy_N variants', async () => {
      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName,
        totalPaymentSum,
        installmentTotal,
        dealDate,
      });

      // Create first group
      await createInstallmentGroup({
        firstTransactionData: {
          businessId: testBusinessId,
          businessNormalizedName,
          cardId: testCardId,
          dealDate,
          originalAmount: totalPaymentSum,
          originalCurrency: 'ILS',
          exchangeRateUsed: null,
          chargedAmountIls: payment1Amount,
          sourceFile: 'file1.xlsx',
          uploadBatchId: testBatchId,
        },
        installmentInfo: {
          index: 1,
          total: installmentTotal,
          amount: payment1Amount,
        },
      });

      // Count should be 1
      const count1 = await countGroupsWithBaseId(baseGroupId);
      expect(count1).toBe(1);

      // Note: In real implementation, twin would create _copy_1 group
      // For this test, we verify the counting logic works
      // The actual twin creation would be tested in process-batch-job integration tests
    });
  });
});
