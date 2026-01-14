/**
 * Start Test Server
 * 
 * Automatically starts Next.js dev server for integration tests
 * Similar to Playwright's webServer configuration
 */

import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';

let serverProcess: ChildProcess | null = null;
const SERVER_PORT = 3000;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000; // ms

/**
 * Check if server is responding
 */
async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/login`);
    return response.status === 200 || response.status === 401;
  } catch {
    return false;
  }
}

/**
 * Kill any process using the server port
 */
function killPortProcess(port: number): void {
  console.log(`Cleaning up port ${port}...`);
  try {
    if (process.platform === 'win32') {
      // Windows
      try {
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = output.split('\n');
        const pids = new Set<string>();
        
        for (const line of lines) {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) {
            pids.add(match[1]);
          }
        }
        
        pids.forEach(pid => {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`Killed process ${pid} on port ${port}`);
          } catch {}
        });
      } catch {}
    } else {
      // Unix-like - more aggressive cleanup
      try {
        // Try to find and kill processes on the port
        const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: 'pipe' });
        const pids = result.trim().split('\n').filter(pid => pid);
        
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`Killed process ${pid} on port ${port}`);
          } catch {}
        }
      } catch {
        // No process found, that's fine
      }
      
      // Also try fuser as backup
      try {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
      } catch {
        // fuser might not be available
      }
    }
    
    console.log(`✓ Port ${port} cleaned`);
  } catch (error) {
    console.log(`Port ${port} is free`);
  }
}

/**
 * Wait for server to be ready
 */
async function waitForServer(): Promise<void> {
  console.log(`Waiting for server at ${SERVER_URL}...`);
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    if (await isServerReady()) {
      console.log('✓ Server is ready');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  
  throw new Error(`Server failed to start after ${MAX_RETRIES} attempts`);
}

/**
 * Start dev server
 */
export async function startServer(): Promise<void> {
  console.log('\n=== Starting Test Server ===\n');
  
  // Kill any existing process on the port
  killPortProcess(SERVER_PORT);
  
  // Start server
  console.log('Starting Next.js dev server...');
  
  serverProcess = spawn('npm', ['run', 'dev'], {
    env: {
      ...process.env,
      // Use DATABASE_URL from environment (CI) or fallback to local dev
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_integration',
      NODE_ENV: 'test',
      PORT: SERVER_PORT.toString(),
    },
    shell: true,
    stdio: 'pipe', // Capture output but don't display
  });
  
  // Wait for server to be ready
  await waitForServer();
  
  console.log('\n=== Test Server Ready ===\n');
}

/**
 * Stop dev server
 */
export async function stopServer(): Promise<void> {
  console.log('\n=== Stopping Test Server ===\n');
  
  try {
    // Kill the server process if we have a reference
    if (serverProcess && serverProcess.pid) {
      console.log(`Stopping server process ${serverProcess.pid}...`);
      
      if (process.platform === 'win32') {
        // Windows: kill process tree
        try {
          execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore', timeout: 5000 });
          console.log(`Killed Windows process tree ${serverProcess.pid}`);
        } catch (err) {
          console.warn('Failed to kill Windows process');
        }
      } else {
        // Unix: try SIGTERM first, then SIGKILL
        try {
          serverProcess.kill('SIGTERM');
          // Wait briefly for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Force kill if still running
          if (!serverProcess.killed) {
            serverProcess.kill('SIGKILL');
            console.log(`Force killed process ${serverProcess.pid}`);
          } else {
            console.log(`Gracefully stopped process ${serverProcess.pid}`);
          }
        } catch (err) {
          console.warn('Failed to kill Unix process');
        }
      }
      
      serverProcess = null;
    }
    
    // Always clean up the port as a safety measure
    // This ensures no orphaned processes are left
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for port to free
    killPortProcess(SERVER_PORT);
    
    console.log('✓ Server stopped');
  } catch (error) {
    console.error('Error stopping server:', error);
    // Still try to clean up port even if process kill failed
    try {
      killPortProcess(SERVER_PORT);
    } catch {}
  }
}
