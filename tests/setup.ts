/**
 * Vitest Setup File
 * 
 * Runs before all tests to set up the environment.
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  process.env.AUTH_USERNAME = 'testuser';
  process.env.AUTH_PASSWORD_HASH_BASE64 = Buffer.from('$2b$12$test').toString('base64');
  // Set a dummy DATABASE_URL for tests that don't actually connect
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb';
});

afterAll(async () => {
  // Cleanup if needed
});
