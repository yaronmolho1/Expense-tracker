/**
 * Playwright Global Setup
 * 
 * Runs once before all tests start.
 * Resets the test database to ensure clean state.
 */

import { resetTestDatabase } from './test-db';
import { seedTestDatabase } from './seed-test-db';

async function globalSetup() {
  console.log('\n🧪 Playwright Global Setup Starting...\n');
  
  try {
    // Reset database (drop, migrate)
    await resetTestDatabase();
    
    // Seed with basic data
    seedTestDatabase();
    
    // Note: Playwright manages webServer lifecycle - don't kill it here!
    
    console.log('✓ Global setup complete - ready for tests!\n');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;
