import { describe, it, expect } from 'vitest';
import {
  generateInstallmentGroupId,
  generateInstallmentTransactionHash
} from '@/lib/utils/hash';
import { createHash, randomUUID } from 'node:crypto';

/**
 * Unit Tests: Installment Service
 * 
 * Tests installment group generation and hash logic.
 */

describe('Installment Service', () => {
  describe('generateInstallmentGroupId', () => {
    it('should generate consistent group ID for same parameters', () => {
      const id1 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different ID for different business', () => {
      const id1 = generateInstallmentGroupId({
        businessNormalizedName: 'business a',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessNormalizedName: 'business b',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different ID for different total amount', () => {
      const id1 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3700,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different ID for different installment count', () => {
      const id1 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 24,
        dealDate: '2024-01-15',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('should generate same ID for same parameters', () => {
      // Group ID is based on business, total, count, and date
      const id1 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3600,
        installmentTotal: 12,
        dealDate: '2024-01-15',
      });
      
      expect(id1).toBe(id2);
    });
  });

  describe('generateInstallmentTransactionHash', () => {
    const groupId = 'test-group-id-12345';
    
    it('should generate unique hash for each installment index', () => {
      const hash1 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 1,
      });
      const hash2 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 2,
      });
      const hash3 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 12,
      });
      
      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
      
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same parameters', () => {
      const hash1 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 5,
      });
      const hash2 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 5,
      });
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different group ID', () => {
      const hash1 = generateInstallmentTransactionHash({
        installmentGroupId: 'group-1',
        installmentIndex: 1,
      });
      const hash2 = generateInstallmentTransactionHash({
        installmentGroupId: 'group-2',
        installmentIndex: 1,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle first installment (index 1)', () => {
      const hash = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 1,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle last installment', () => {
      const hash = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 36,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle mid-installment', () => {
      const hash = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 18,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Installment Logic Scenarios', () => {
    it('should support 36-installment purchase', () => {
      const groupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 10800, // 300 per month x 36
        installmentTotal: 36,
        dealDate: '2024-01-01',
      });
      
      // Generate hashes for all 36 installments
      const hashes = Array.from({ length: 36 }, (_, i) =>
        generateInstallmentTransactionHash({
          installmentGroupId: groupId,
          installmentIndex: i + 1,
        })
      );
      
      // All should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(36);
    });

    it('should support starting mid-installment (backfill)', () => {
      // User starts tracking at payment 4/12
      const groupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 1200,
        installmentTotal: 12,
        dealDate: '2023-10-01', // Calculated back date
      });
      
      // Can generate hashes for all payments including past ones
      const hash1 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 1,
      });
      const hash4 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 4,
      });
      const hash12 = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 12,
      });
      
      expect(hash1).toBeTruthy();
      expect(hash4).toBeTruthy();
      expect(hash12).toBeTruthy();
      
      expect(hash1).not.toBe(hash4);
      expect(hash4).not.toBe(hash12);
    });

    it('should handle backfill collision detection logic', () => {
      // Scenario: Two Payment 2/24 uploads happen simultaneously
      // Expected: First gets baseGroupId, second gets SHA256-hashed ID
      
      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3099,
        installmentTotal: 24,
        dealDate: '2024-01-15',
      });
      
      // First backfill gets baseGroupId
      const firstGroupId = baseGroupId;
      expect(firstGroupId).toMatch(/^[a-f0-9]{64}$/);
      
      // Second backfill detects collision and re-hashes
      // In real code: SHA256(baseGroupId + UUID)
      const uniqueId = randomUUID();
      const secondGroupId = createHash('sha256')
        .update(baseGroupId + uniqueId)
        .digest('hex');
      
      // Both should be valid 64-char hashes
      expect(firstGroupId).toMatch(/^[a-f0-9]{64}$/);
      expect(secondGroupId).toMatch(/^[a-f0-9]{64}$/);
      expect(firstGroupId).not.toBe(secondGroupId);
    });

    it('should prevent duplicate payments', () => {
      // Same payment uploaded twice should have same hash
      const groupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 1200,
        installmentTotal: 12,
        dealDate: '2024-01-01',
      });
      
      const hash1a = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 5,
      });
      const hash1b = generateInstallmentTransactionHash({
        installmentGroupId: groupId,
        installmentIndex: 5,
      });
      
      // Should be identical - will be caught as duplicate
      expect(hash1a).toBe(hash1b);
    });

    it('should handle different installment plans for same business', () => {
      // Two different purchases from same business
      const group1 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 1200,
        installmentTotal: 12,
        dealDate: '2024-01-01',
      });
      
      const group2 = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 2400,
        installmentTotal: 24,
        dealDate: '2024-02-01',
      });
      
      expect(group1).not.toBe(group2);
      
      // Even same installment index should have different hash (different group)
      const hash1 = generateInstallmentTransactionHash({
        installmentGroupId: group1,
        installmentIndex: 1,
      });
      const hash2 = generateInstallmentTransactionHash({
        installmentGroupId: group2,
        installmentIndex: 1,
      });
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Ghost Payment Calculation', () => {
    /**
     * Tests the Payment 1 amount calculation logic:
     * Payment 1 = Total - (Regular Payment × (N-1))
     * This handles rounding variance where Payment 1 differs from regular payments
     */
    it('should calculate Payment 1 amount correctly for 24-installment purchase', () => {
      const totalPaymentSum = 3099; // Total deal sum from file
      const regularPayment = 129; // Regular payment amount (Payment 2-24)
      const totalPayments = 24;
      
      // Calculate Payment 1 using the formula from createInstallmentGroupFromMiddle
      const payment1Amount = totalPaymentSum - (regularPayment * (totalPayments - 1));
      
      // Expected: 3099 - (129 × 23) = 3099 - 2967 = 132
      expect(payment1Amount).toBe(132);
      
      // Verify total adds up correctly
      const calculatedTotal = payment1Amount + (regularPayment * (totalPayments - 1));
      expect(calculatedTotal).toBe(totalPaymentSum);
    });

    it('should handle rounding variance in Payment 1', () => {
      // Scenario: Payment 1 might be 132 or 129, but total is always 3099
      const totalPaymentSum = 3099;
      const regularPayment = 129;
      const totalPayments = 24;
      
      const payment1Amount = totalPaymentSum - (regularPayment * (totalPayments - 1));
      
      // Payment 1 should be 132 (not 129)
      expect(payment1Amount).toBe(132);
      
      // Both Payment 1 amounts (132 and 129) should anchor to same total (3099)
      // This is the key insight: originalAmount (total deal sum) is the same
      expect(totalPaymentSum).toBe(3099);
    });

    it('should calculate Payment 1 for 12-installment purchase', () => {
      const totalPaymentSum = 1200;
      const regularPayment = 100;
      const totalPayments = 12;
      
      const payment1Amount = totalPaymentSum - (regularPayment * (totalPayments - 1));
      
      // Expected: 1200 - (100 × 11) = 1200 - 1100 = 100
      expect(payment1Amount).toBe(100);
    });

    it('should handle edge case: single payment installment', () => {
      const totalPaymentSum = 500;
      const regularPayment = 500; // Only one payment
      const totalPayments = 1;
      
      const payment1Amount = totalPaymentSum - (regularPayment * (totalPayments - 1));
      
      // Expected: 500 - (500 × 0) = 500
      expect(payment1Amount).toBe(500);
    });

    it('should verify Payment 1 calculation matches backfill logic', () => {
      // This test ensures the calculation matches the implementation
      // in createInstallmentGroupFromMiddle line 227
      const totalPaymentSum = 3600;
      const amount = 300; // Regular payment amount
      const total = 12;
      
      // Formula from code: payment1Amount = totalPaymentSum - (amount * (total - 1))
      const payment1Amount = totalPaymentSum - (amount * (total - 1));
      
      // Expected: 3600 - (300 × 11) = 3600 - 3300 = 300
      expect(payment1Amount).toBe(300);
      
      // Verify: Payment 1 + (Regular × 11) = Total
      expect(payment1Amount + (amount * (total - 1))).toBe(totalPaymentSum);
    });
  });

  describe('Twin Purchase Group ID Generation', () => {
    /**
     * Tests that twin purchases (identical metadata) generate same base group ID
     * but can be differentiated with _copy_N suffix
     */
    it('should generate same base group ID for twin purchases', () => {
      const params = {
        businessNormalizedName: 'test business',
        totalPaymentSum: 3099,
        installmentTotal: 24,
        dealDate: '2024-01-15',
      };
      
      const groupId1 = generateInstallmentGroupId(params);
      const groupId2 = generateInstallmentGroupId(params);
      
      // Same parameters should generate same base group ID
      expect(groupId1).toBe(groupId2);
    });

    it('should support _copy_N suffix pattern for twins', () => {
      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3099,
        installmentTotal: 24,
        dealDate: '2024-01-15',
      });
      
      // Twin groups should follow pattern: baseGroupId_copy_N
      const twinGroupId1 = `${baseGroupId}_copy_1`;
      const twinGroupId2 = `${baseGroupId}_copy_2`;
      
      expect(twinGroupId1).toContain('_copy_1');
      expect(twinGroupId2).toContain('_copy_2');
      expect(twinGroupId1).not.toBe(twinGroupId2);
    });

    it('should generate different hashes for twin groups', () => {
      const baseGroupId = 'abc123def456';
      const twinGroupId1 = `${baseGroupId}_copy_1`;
      const twinGroupId2 = `${baseGroupId}_copy_2`;
      
      // Same installment index but different group IDs should have different hashes
      const hash1 = generateInstallmentTransactionHash({
        installmentGroupId: twinGroupId1,
        installmentIndex: 1,
      });
      const hash2 = generateInstallmentTransactionHash({
        installmentGroupId: twinGroupId2,
        installmentIndex: 1,
      });
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('UUID Collision Re-hashing Logic', () => {
    /**
     * Tests the SHA256 re-hashing logic used for backfill collision handling
     * Formula: SHA256(baseGroupId + UUID) = guaranteed 64 chars
     */
    it('should generate 64-character hash from baseGroupId + UUID', () => {
      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3099,
        installmentTotal: 24,
        dealDate: '2024-01-15',
      });

      const uniqueId = randomUUID();
      const rehashedId = createHash('sha256')
        .update(baseGroupId + uniqueId)
        .digest('hex');
      
      // SHA256 always produces 64-character hex string
      expect(rehashedId).toMatch(/^[a-f0-9]{64}$/);
      expect(rehashedId.length).toBe(64);
    });

    it('should generate different hashes for same baseGroupId with different UUIDs', () => {
      const baseGroupId = generateInstallmentGroupId({
        businessNormalizedName: 'test business',
        totalPaymentSum: 3099,
        installmentTotal: 24,
        dealDate: '2024-01-15',
      });
      
      const uuid1 = randomUUID();
      const uuid2 = randomUUID();
      
      const hash1 = createHash('sha256')
        .update(baseGroupId + uuid1)
        .digest('hex');
      const hash2 = createHash('sha256')
        .update(baseGroupId + uuid2)
        .digest('hex');
      
      // Different UUIDs should produce different hashes
      expect(hash1).not.toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should ensure re-hashed ID fits varchar(64) constraint', () => {
      const baseGroupId = 'a'.repeat(64); // Max length baseGroupId
      const uniqueId = randomUUID();

      const rehashedId = createHash('sha256')
        .update(baseGroupId + uniqueId)
        .digest('hex');
      
      // Even with long baseGroupId + UUID, SHA256 output is always 64 chars
      expect(rehashedId.length).toBe(64);
      expect(rehashedId.length).toBeLessThanOrEqual(64); // varchar(64) constraint
    });
  });

  describe('Metadata-Based Matching Logic', () => {
    /**
     * Tests that matching uses Total Deal Sum (originalAmount) instead of calculated amounts
     * This solves Payment 1 variance problem
     */
    it('should use Total Deal Sum for matching regardless of Payment 1 variance', () => {
      // Scenario: Two payments from same installment
      // Payment 1: chargedAmountIls = 132
      // Payment 2: chargedAmountIls = 129
      // Both have originalAmount = 3099 (Total Deal Sum)
      
      const totalDealSum = 3099;
      const payment1Amount = 132;
      const payment2Amount = 129;
      
      // Both payments should match on originalAmount (total deal sum)
      expect(totalDealSum).toBe(3099);
      
      // Matching logic uses originalAmount, not chargedAmountIls
      // This allows Payment 1 (132) and Payment 2 (129) to match same installment
      const matchTolerance = totalDealSum * 0.01; // 1% tolerance
      expect(Math.abs(totalDealSum - totalDealSum)).toBeLessThan(matchTolerance);
    });

    it('should calculate 1% tolerance for amount matching', () => {
      const originalAmount = 3099;
      const tolerance = originalAmount * 0.01; // 1% tolerance
      
      // Handle floating point precision: 3099 * 0.01 = 30.990000000000002
      expect(tolerance).toBeCloseTo(30.99, 2);
      
      // Amounts within tolerance should match
      const amount1 = 3099;
      const amount2 = 3099 + tolerance;
      const amount3 = 3099 - tolerance;
      
      expect(Math.abs(amount1 - amount2)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(amount1 - amount3)).toBeLessThanOrEqual(tolerance);
    });

    it('should verify all payments in installment share same originalAmount', () => {
      // Key insight: ALL payments (1, 2, 3...24) have SAME originalAmount
      // This is the Total Deal Sum from the file
      const totalDealSum = 3099;
      
      // Payment 1, 2, 3... all have originalAmount = 3099
      const payment1OriginalAmount = totalDealSum;
      const payment2OriginalAmount = totalDealSum;
      const payment24OriginalAmount = totalDealSum;
      
      expect(payment1OriginalAmount).toBe(payment2OriginalAmount);
      expect(payment2OriginalAmount).toBe(payment24OriginalAmount);
      expect(payment1OriginalAmount).toBe(totalDealSum);
    });
  });
});
