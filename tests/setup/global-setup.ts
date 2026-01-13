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
    
    // Kill any existing server on port 3000
    await killServerOnPort(3000);
    
    console.log('✓ Global setup complete - ready for tests!\n');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Kill any process using the specified port
 */
async function killServerOnPort(port: number): Promise<void> {
  try {
    const { execSync } = require('child_process');
    
    // Windows
    if (process.platform === 'win32') {
      console.log(`Checking for processes on port ${port}...`);
      try {
        const netstatOutput = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = netstatOutput.split('\n').filter(line => line.includes('LISTENING'));
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          
          if (pid && !isNaN(parseInt(pid))) {
            console.log(`Killing process ${pid} on port ${port}...`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          }
        }
        console.log(`✓ Cleared port ${port}`);
      } catch (error) {
        // No process found on port, that's fine
        console.log(`✓ Port ${port} is free`);
      }
    }
    // Unix/Linux/Mac
    else {
      try {
        const lsofOutput = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
        const pids = lsofOutput.trim().split('\n').filter(pid => pid);
        
        for (const pid of pids) {
          console.log(`Killing process ${pid} on port ${port}...`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        }
        console.log(`✓ Cleared port ${port}`);
      } catch (error) {
        // No process found on port, that's fine
        console.log(`✓ Port ${port} is free`);
      }
    }
  } catch (error) {
    console.log(`Note: Could not check/clear port ${port}:`, error);
  }
}

export default globalSetup;
