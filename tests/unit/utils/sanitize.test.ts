import { describe, it, expect } from 'vitest';
import { 
  sanitizeHtml, 
  sanitizeInput,
  sanitizeDisplayName,
  sanitizeSearchQuery 
} from '@/lib/utils/sanitize';

/**
 * Unit Tests: Input Sanitization
 * 
 * Tests XSS prevention and SQL injection protection.
 */

describe('Sanitization Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should remove onclick handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    it('should remove style tags', () => {
      const input = 'Text <style>body{display:none}</style> more text';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('<style>');
      expect(result).toContain('Text');
    });

    it('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('<iframe>');
      expect(result).not.toContain('evil.com');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
    });

    it('should preserve safe text', () => {
      const input = 'This is safe text with numbers 123 and symbols !@#';
      const result = sanitizeHtml(input);
      
      expect(result).toBe(input);
    });
  });

  describe('sanitizeInput', () => {
    it('should trim whitespace', () => {
      const result = sanitizeInput('  hello world  ');
      
      expect(result).toBe('hello world');
    });

    it('should remove HTML tags', () => {
      const result = sanitizeInput('<b>Bold</b> text');
      
      expect(result).not.toContain('<b>');
      expect(result).toContain('Bold text');
    });

    it('should handle empty string', () => {
      expect(sanitizeInput('')).toBe('');
    });

    it('should handle very long input', () => {
      const longInput = 'a'.repeat(10000);
      const result = sanitizeInput(longInput);
      
      expect(result.length).toBeLessThanOrEqual(1000); // Assuming truncation
    });
  });

  describe('sanitizeDisplayName', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeDisplayName('<script>alert(1)</script>Test Business');
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('Test Business');
    });

    it('should preserve Hebrew characters', () => {
      const input = 'בית קפה תל אביב';
      const result = sanitizeDisplayName(input);
      
      expect(result).toBe(input);
    });

    it('should preserve special business characters', () => {
      const input = "McDonald's & Co. (Ltd.)";
      const result = sanitizeDisplayName(input);
      
      expect(result).toContain("McDonald's");
      expect(result).toContain('&');
      expect(result).toContain('.');
    });

    it('should remove excessive whitespace', () => {
      const result = sanitizeDisplayName('Business    Name    Here');
      
      expect(result).toBe('Business Name Here');
    });

    it('should handle null', () => {
      expect(sanitizeDisplayName(null as any)).toBe('');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should escape SQL special characters', () => {
      const result = sanitizeSearchQuery("Robert'); DROP TABLE users; --");
      
      expect(result).not.toContain('DROP TABLE');
      expect(result).not.toContain('--');
    });

    it('should preserve search terms', () => {
      const result = sanitizeSearchQuery('coffee shop');
      
      expect(result).toContain('coffee');
      expect(result).toContain('shop');
    });

    it('should handle wildcards safely', () => {
      const result = sanitizeSearchQuery('%malicious%');
      
      // Should escape or remove SQL wildcards
      expect(result).not.toMatch(/^%.*%$/);
    });

    it('should trim whitespace', () => {
      const result = sanitizeSearchQuery('  search term  ');
      
      expect(result).toBe('search term');
    });

    it('should handle empty search', () => {
      expect(sanitizeSearchQuery('')).toBe('');
      expect(sanitizeSearchQuery('   ')).toBe('');
    });

    it('should handle Hebrew search terms', () => {
      const input = 'קפה';
      const result = sanitizeSearchQuery(input);
      
      expect(result).toBe(input);
    });
  });
});
