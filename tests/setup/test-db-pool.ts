/**
 * Test Database Connection Pool
 * 
 * Provides transaction-wrapped database connections for tests.
 * Each test gets its own transaction that's rolled back after the test.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';

// Test database URL
const TEST_DB_URL = process.env.DATABASE_URL || 
  'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_integration';

/**
 * Get database connection (singleton)
 * Uses the same global singleton as lib/db/index.ts
 */
export function getTestDb() {
  // Use the same global client as lib/db to ensure transaction isolation works
  if (!(global as any).__testDbClient) {
    (global as any).__testDbClient = postgres(TEST_DB_URL, {
      max: 1, // Single connection for tests
      idle_timeout: 0,
      connect_timeout: 10,
    });
  }

  const connection = (global as any).__testDbClient;
  const db = drizzle(connection, { schema });

  return { connection, db };
}

/**
 * Start a transaction for a test
 * Returns a cleanup function to rollback
 */
export async function beginTestTransaction() {
  const { connection } = getTestDb();
  
  // Start transaction
  await connection`BEGIN`;
  
  // Return rollback function
  return async () => {
    try {
      await connection`ROLLBACK`;
    } catch (error) {
      console.error('Error rolling back transaction:', error);
    }
  };
}

/**
 * Close database connection
 */
export async function closeTestDb() {
  if ((global as any).__testDbClient) {
    await (global as any).__testDbClient.end();
    delete (global as any).__testDbClient;
  }
}

/**
 * Run a function within a test transaction
 * Automatically rolls back after
 */
export async function withTestTransaction<T>(
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const { connection, db } = getTestDb();
  
  await connection`BEGIN`;
  
  try {
    const result = await fn(db);
    await connection`ROLLBACK`;
    return result;
  } catch (error) {
    await connection`ROLLBACK`;
    throw error;
  }
}
