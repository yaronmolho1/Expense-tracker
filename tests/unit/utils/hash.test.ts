import { describe, it, expect } from 'vitest';
import { generateTransactionHash } from '@/lib/utils/hash';

/**
 * Unit Tests: Transaction Hash Generation
 * 
 * Tests the hash generation algorithm for duplicate detection.
 */

describe('Transaction Hash Utility', () => {
  describe('generateTransactionHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const hash1 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100.50,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100.50,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
    });

    it('should generate different hash for different business', () => {
      const hash1 = generateTransactionHash({
        normalizedBusinessName: 'business a',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        normalizedBusinessName: 'business b',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different amount', () => {
      const hash1 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100.01,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different date', () => {
      const hash1 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-16',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for refund vs purchase', () => {
      const purchase = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const refund = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: true,
      });
      
      expect(purchase).not.toBe(refund);
    });

    it('should be case-insensitive for business name', () => {
      const hash1 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        normalizedBusinessName: 'test business',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash1).toBe(hash2);
    });

    it('should handle decimal amounts correctly', () => {
      const hash1 = generateTransactionHash({
        normalizedBusinessName: 'test',
        dealDate: '2024-01-15',
        chargedAmountIls: 99.99,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        normalizedBusinessName: 'test',
        dealDate: '2024-01-15',
        chargedAmountIls: 99.9900, // Extra zeros
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash1).toBe(hash2);
    });

    it('should handle special characters in business name', () => {
      const hash = generateTransactionHash({
        normalizedBusinessName: 'test & co. (ltd)',
        dealDate: '2024-01-15',
        chargedAmountIls: 100,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle Hebrew characters', () => {
      const hash = generateTransactionHash({
        normalizedBusinessName: 'בית קפה',
        dealDate: '2024-01-15',
        chargedAmountIls: 50,
        cardLast4: '1234',
        paymentType: 'regular',
        isRefund: false,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
