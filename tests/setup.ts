/**
 * Vitest Setup File for UNIT TESTS ONLY
 *
 * Runs before all tests to set up the environment.
 * IMPORTANT: Set env vars at top level (before imports) so modules can read them.
 */

// Load .env file to get DATABASE_URL for tests that need DB access
import { config } from 'dotenv';
config();

// Set test environment variables BEFORE any imports
(process.env as any).NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
process.env.AUTH_USERNAME = process.env.AUTH_USERNAME || 'testuser';
process.env.AUTH_PASSWORD_HASH_BASE64 = process.env.AUTH_PASSWORD_HASH_BASE64 || Buffer.from('$2b$12$test').toString('base64');
// DATABASE_URL is now loaded from .env file via dotenv above
// If it's still not set, use a dummy value for tests that don't need real DB
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
}

import { beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom';

beforeAll(async () => {
  // Additional setup if needed
});

afterAll(async () => {
  // Cleanup if needed
});
