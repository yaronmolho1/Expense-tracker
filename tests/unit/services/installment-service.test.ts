import { describe, it, expect } from 'vitest';
import { 
  generateInstallmentGroupId,
  generateInstallmentTransactionHash 
} from '@/lib/utils/hash';

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
});
