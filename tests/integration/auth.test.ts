import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken, extractToken } from '@/lib/utils/auth';
import { hashPassword, verifyPassword } from '@/lib/utils/auth-password';

/**
 * Integration Tests: Authentication Utilities
 * 
 * Tests JWT generation, verification, and password hashing.
 */

describe('Authentication Utilities', () => {
  describe('JWT Token Generation and Verification', () => {
    it('should generate a valid JWT token', async () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
      };

      const token = await generateToken(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify a valid token', async () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
      };

      const token = await generateToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should reject a malformed token', async () => {
      const malformedToken = 'notavalidtoken';

      await expect(verifyToken(malformedToken)).rejects.toThrow();
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Authorization header', () => {
      const testToken = 'test-token-123';
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      });
      
      const extractedToken = extractToken(request);
      
      expect(extractedToken).toBe(testToken);
    });

    it('should extract token from cookie', () => {
      const testToken = 'test-token-456';
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'cookie': `auth_token=${testToken}; other_cookie=value`,
        },
      });
      
      const extractedToken = extractToken(request);
      
      expect(extractedToken).toBe(testToken);
    });

    it('should return null when no token present', () => {
      const request = new Request('http://localhost:3000/api/test');
      
      const extractedToken = extractToken(request);
      
      expect(extractedToken).toBeNull();
    });

    it('should prioritize Authorization header over cookie', () => {
      const headerToken = 'header-token';
      const cookieToken = 'cookie-token';
      
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${headerToken}`,
          'cookie': `auth_token=${cookieToken}`,
        },
      });
      
      const extractedToken = extractToken(request);
      
      expect(extractedToken).toBe(headerToken);
    });
  });

  describe('Password Hashing and Verification', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123';
      
      const hash = await hashPassword(password);
      
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt format
    });

    it('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });
});
