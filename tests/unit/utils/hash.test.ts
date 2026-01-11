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
        businessName: 'Test Business',
        amount: 100.50,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100.50,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
    });

    it('should generate different hash for different business', () => {
      const hash1 = generateTransactionHash({
        businessName: 'Business A',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        businessName: 'Business B',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different amount', () => {
      const hash1 = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100.01,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different date', () => {
      const hash1 = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100,
        date: '2024-01-16',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for refund vs purchase', () => {
      const purchase = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const refund = generateTransactionHash({
        businessName: 'Test Business',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: true,
      });
      
      expect(purchase).not.toBe(refund);
    });

    it('should be case-insensitive for business name', () => {
      const hash1 = generateTransactionHash({
        businessName: 'TEST BUSINESS',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        businessName: 'test business',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash1).toBe(hash2);
    });

    it('should handle decimal amounts correctly', () => {
      const hash1 = generateTransactionHash({
        businessName: 'Test',
        amount: 99.99,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      const hash2 = generateTransactionHash({
        businessName: 'Test',
        amount: 99.9900, // Extra zeros
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash1).toBe(hash2);
    });

    it('should handle special characters in business name', () => {
      const hash = generateTransactionHash({
        businessName: 'Test & Co. (Ltd)',
        amount: 100,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle Hebrew characters', () => {
      const hash = generateTransactionHash({
        businessName: 'בית קפה',
        amount: 50,
        date: '2024-01-15',
        cardLast4: '1234',
        isRefund: false,
      });
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
