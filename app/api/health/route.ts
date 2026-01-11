/**
 * GET /api/health
 * 
 * Health check endpoint for monitoring and CI/CD.
 * Returns system health status including database connectivity.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'down';
      latency?: number;
      error?: string;
    };
    server: {
      status: 'ok';
      uptime: number;
      memory: {
        used: number;
        total: number;
        percentage: number;
      };
    };
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ status: 'ok' | 'down'; latency?: number; error?: string }> {
  const start = Date.now();
  
  try {
    // Simple ping query
    await db.execute(sql`SELECT 1`);
    
    const latency = Date.now() - start;
    
    return {
      status: 'ok',
      latency,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get server health metrics
 */
function getServerHealth() {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal + memUsage.external;
  const usedMemory = memUsage.heapUsed;
  
  return {
    status: 'ok' as const,
    uptime: process.uptime(),
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
  };
}

export async function GET() {
  const timestamp = new Date().toISOString();
  
  // Run health checks
  const [dbHealth, serverHealth] = await Promise.all([
    checkDatabase(),
    Promise.resolve(getServerHealth()),
  ]);
  
  // Determine overall status
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
  
  if (dbHealth.status === 'down') {
    overallStatus = 'down';
  }
  
  const healthCheck: HealthCheck = {
    status: overallStatus,
    timestamp,
    checks: {
      database: dbHealth,
      server: serverHealth,
    },
  };
  
  // Return appropriate status code
  const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  
  return NextResponse.json(healthCheck, { status: statusCode });
}
