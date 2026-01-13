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
  try {
    if (process.platform === 'win32') {
      // Windows
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
        } catch {}
      });
    } else {
      // Unix-like
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch {
    // No process using port, that's fine
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
  if (serverProcess) {
    console.log('\n=== Stopping Test Server ===\n');
    
    try {
      // Kill the process gracefully first
      if (process.platform === 'win32') {
        // Windows: kill process tree
        try {
          execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore', timeout: 5000 });
        } catch (err) {
          console.warn('Failed to kill Windows process:', err);
        }
      } else {
        // Unix: try SIGTERM first, then SIGKILL if needed
        try {
          if (serverProcess.pid) {
            serverProcess.kill('SIGTERM');
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Force kill if still running
            if (!serverProcess.killed) {
              serverProcess.kill('SIGKILL');
            }
          }
        } catch (err) {
          console.warn('Failed to kill Unix process:', err);
        }
      }
      
      serverProcess = null;
      
      // Clean up port
      try {
        killPortProcess(SERVER_PORT);
      } catch (err) {
        console.warn('Failed to clean up port:', err);
      }
      
      console.log('✓ Server stopped');
    } catch (error) {
      console.error('Error stopping server:', error);
      // Don't throw - we want teardown to continue
    }
  }
}
