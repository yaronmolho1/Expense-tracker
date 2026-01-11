/**
 * Global Setup for Integration Tests
 * 
 * Runs once before all integration tests:
 * 1. Reset integration test database (one-time setup)
 * 2. Seed base data (categories, cards)
 * 3. Start dev server
 * 
 * Note: Each test runs in its own transaction (auto-rollback)
 */

import { resetIntegrationDatabase } from './integration-db';
import { startServer, stopServer } from './start-test-server';
import { closeTestDb } from './test-db-pool';

export default async function globalSetup() {
  console.log('\n=== Integration Test Global Setup ===\n');
  console.log('Using transaction-based test isolation');
  console.log('Each test runs in its own transaction (auto-rollback)\n');
  
  try {
    // One-time database setup (migrations + seed base data)
    await resetIntegrationDatabase();
    
    // Start server
    await startServer();
    
    console.log('\n=== Integration Test Setup Complete ===\n');
    
    // Return teardown function
    return async () => {
      console.log('\n=== Integration Test Teardown ===\n');
      await stopServer();
      await closeTestDb();
      console.log('✓ Teardown complete\n');
    };
  } catch (error) {
    console.error('Failed to setup integration tests:', error);
    await stopServer();
    await closeTestDb();
    throw error;
  }
}
