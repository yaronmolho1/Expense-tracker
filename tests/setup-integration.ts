/**
 * Vitest Setup File for Integration Tests ONLY
 * 
 * Includes transaction hooks that wrap each test in BEGIN/ROLLBACK
 */

// Set test environment variables BEFORE any imports
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
}
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
process.env.AUTH_USERNAME = process.env.AUTH_USERNAME || 'testuser';
process.env.AUTH_PASSWORD_HASH_BASE64 = process.env.AUTH_PASSWORD_HASH_BASE64 || Buffer.from('$2b$12$test').toString('base64');

import { beforeAll, afterAll } from 'vitest';
import { closeTestDb } from './setup/test-db-pool';

// Import transaction hooks for integration tests
import './setup/vitest-hooks';

beforeAll(async () => {
  console.log('Integration test setup: Transaction hooks active');
});

afterAll(async () => {
  // Close database connection
  await closeTestDb();
});
