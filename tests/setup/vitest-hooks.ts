/**
 * Vitest Test Hooks
 * 
 * Automatic transaction wrapping for each test
 */

import { beforeEach, afterEach } from 'vitest';
import { beginTestTransaction } from './test-db-pool';

let rollback: (() => Promise<void>) | null = null;

/**
 * Before each test: Start transaction
 */
beforeEach(async () => {
  // Only for integration tests (not unit tests)
  if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL) {
    rollback = await beginTestTransaction();
  }
});

/**
 * After each test: Rollback transaction
 */
afterEach(async () => {
  if (rollback) {
    await rollback();
    rollback = null;
  }
});
