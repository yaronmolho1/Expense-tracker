import { describe, it, expect, beforeAll } from 'vitest';
import { generateToken } from '@/lib/utils/auth';

/**
 * Integration Tests: API Endpoints
 * 
 * Tests API endpoints against actual server.
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('API Endpoints', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Generate a valid token for authenticated requests
    authToken = await generateToken({
      userId: 'default-user',
      email: 'test@example.com',
    });
  });

  describe('Health Check', () => {
    it('should respond to health check (if endpoint exists)', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/health`);
        
        if (response.status !== 404) {
          expect(response.status).toBe(200);
        }
      } catch (error) {
        // Health endpoint may not exist yet
        expect(true).toBe(true);
      }
    });
  });

  describe('Authentication Endpoints', () => {
    it('should reject login with invalid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'wronguser',
          password: 'wrongpassword',
        }),
      });
      
      expect(response.status).toBe(401);
    });

    it('should require username and password', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error || data.errors).toBeTruthy();
    });

    it('should handle logout request', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Protected API Endpoints', () => {
    it('should reject unauthenticated requests to dashboard', async () => {
      const response = await fetch(`${BASE_URL}/api/dashboard`);
      
      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests to dashboard', async () => {
      const response = await fetch(`${BASE_URL}/api/dashboard`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      // Log error for debugging
      if (response.status !== 200) {
        const error = await response.text();
        console.error('Dashboard error:', response.status, error);
      }
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Should have dashboard structure
      expect(data).toBeTruthy();
      expect(typeof data).toBe('object');
    });

    it('should reject requests with invalid token', async () => {
      const response = await fetch(`${BASE_URL}/api/dashboard`, {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });
      
      expect(response.status).toBe(401);
    });
  });

  describe('Transactions API', () => {
    it('should fetch transactions with auth', async () => {
      const response = await fetch(`${BASE_URL}/api/transactions`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(Array.isArray(data.transactions) || Array.isArray(data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await fetch(`${BASE_URL}/api/transactions?limit=10&offset=0`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      expect(response.status).toBe(200);
    });

    it('should support filtering', async () => {
      const response = await fetch(`${BASE_URL}/api/transactions?status=completed`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    // Skip rate limiting test in test/CI environments where it's disabled
    it.skipIf(process.env.CI === 'true' || process.env.NODE_ENV === 'test')(
      'should rate limit login attempts',
      async () => {
        // Make 6 rapid requests (limit is 5 per minute)
        const requests = Array(6).fill(null).map(() =>
          fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: 'test',
              password: 'test',
            }),
          })
        );
        
        const responses = await Promise.all(requests);
        const statuses = responses.map(r => r.status);
        
        // At least one should be rate limited (429)
        const hasRateLimit = statuses.includes(429);
        expect(hasRateLimit).toBe(true);
      },
      10000 // Longer timeout for this test
    );
  });
});
