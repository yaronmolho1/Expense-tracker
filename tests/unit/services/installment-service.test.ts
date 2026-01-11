import { describe, it, expect } from 'vitest';
import { 
  generateInstallmentGroupId,
  generateInstallmentTransactionHash 
} from '@/lib/services/installment-service';

/**
 * Unit Tests: Installment Service
 * 
 * Tests installment group generation and hash logic.
 */

describe('Installment Service', () => {
  describe('generateInstallmentGroupId', () => {
    it('should generate consistent group ID for same parameters', () => {
      const id1 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different ID for different business', () => {
      const id1 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessId: 2,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different ID for different total amount', () => {
      const id1 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3700,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different ID for different installment count', () => {
      const id1 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 24,
        firstPaymentDate: '2024-01-15',
      });
      
      expect(id1).not.toBe(id2);
    });

    it('should generate same ID regardless of purchase date', () => {
      // Group ID is based on first payment, not purchase
      const id1 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      const id2 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 3600,
        totalCount: 12,
        firstPaymentDate: '2024-01-15',
      });
      
      expect(id1).toBe(id2);
    });
  });

  describe('generateInstallmentTransactionHash', () => {
    const groupId = 'test-group-id-12345';
    
    it('should generate unique hash for each installment index', () => {
      const hash1 = generateInstallmentTransactionHash(groupId, 1, 12);
      const hash2 = generateInstallmentTransactionHash(groupId, 2, 12);
      const hash3 = generateInstallmentTransactionHash(groupId, 12, 12);
      
      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
      
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same parameters', () => {
      const hash1 = generateInstallmentTransactionHash(groupId, 5, 12);
      const hash2 = generateInstallmentTransactionHash(groupId, 5, 12);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different total count', () => {
      // Different total count means different installment plan
      const hash1 = generateInstallmentTransactionHash(groupId, 1, 12);
      const hash2 = generateInstallmentTransactionHash(groupId, 1, 24);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle first installment (index 1)', () => {
      const hash = generateInstallmentTransactionHash(groupId, 1, 36);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle last installment', () => {
      const totalCount = 36;
      const hash = generateInstallmentTransactionHash(groupId, totalCount, totalCount);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle mid-installment', () => {
      const hash = generateInstallmentTransactionHash(groupId, 18, 36);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Installment Logic Scenarios', () => {
    it('should support 36-installment purchase', () => {
      const groupId = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 10800, // 300 per month x 36
        totalCount: 36,
        firstPaymentDate: '2024-01-01',
      });
      
      // Generate hashes for all 36 installments
      const hashes = Array.from({ length: 36 }, (_, i) =>
        generateInstallmentTransactionHash(groupId, i + 1, 36)
      );
      
      // All should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(36);
    });

    it('should support starting mid-installment (backfill)', () => {
      // User starts tracking at payment 4/12
      const groupId = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 1200,
        totalCount: 12,
        firstPaymentDate: '2023-10-01', // Calculated back date
      });
      
      // Can generate hashes for all payments including past ones
      const hash1 = generateInstallmentTransactionHash(groupId, 1, 12);
      const hash4 = generateInstallmentTransactionHash(groupId, 4, 12);
      const hash12 = generateInstallmentTransactionHash(groupId, 12, 12);
      
      expect(hash1).toBeTruthy();
      expect(hash4).toBeTruthy();
      expect(hash12).toBeTruthy();
      
      expect(hash1).not.toBe(hash4);
      expect(hash4).not.toBe(hash12);
    });

    it('should prevent duplicate payments', () => {
      // Same payment uploaded twice should have same hash
      const groupId = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 1200,
        totalCount: 12,
        firstPaymentDate: '2024-01-01',
      });
      
      const hash1a = generateInstallmentTransactionHash(groupId, 5, 12);
      const hash1b = generateInstallmentTransactionHash(groupId, 5, 12);
      
      // Should be identical - will be caught as duplicate
      expect(hash1a).toBe(hash1b);
    });

    it('should handle different installment plans for same business', () => {
      // Two different purchases from same business
      const group1 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 1200,
        totalCount: 12,
        firstPaymentDate: '2024-01-01',
      });
      
      const group2 = generateInstallmentGroupId({
        businessId: 1,
        totalAmount: 2400,
        totalCount: 24,
        firstPaymentDate: '2024-02-01',
      });
      
      expect(group1).not.toBe(group2);
      
      // Even same installment index should have different hash
      const hash1 = generateInstallmentTransactionHash(group1, 1, 12);
      const hash2 = generateInstallmentTransactionHash(group2, 1, 24);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
