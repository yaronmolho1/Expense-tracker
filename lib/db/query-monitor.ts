/**
 * Database Query Monitoring
 * 
 * Logs slow queries and tracks performance metrics.
 */

import logger from '@/lib/logger';

const SLOW_QUERY_THRESHOLD_MS = 100;
const VERY_SLOW_QUERY_THRESHOLD_MS = 500;

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: unknown[];
}

/**
 * Monitor query execution time and log if slow
 */
export async function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  params?: unknown[]
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    
    // Log slow queries
    if (duration > VERY_SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({
        query: queryName,
        duration: `${duration}ms`,
        threshold: `${VERY_SLOW_QUERY_THRESHOLD_MS}ms`,
        params: params ? sanitizeParams(params) : undefined,
      }, 'Very slow query detected');
    } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.info({
        query: queryName,
        duration: `${duration}ms`,
        threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`,
      }, 'Slow query detected');
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error({
      query: queryName,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Query failed');
    
    throw error;
  }
}

/**
 * Sanitize query parameters for logging
 */
function sanitizeParams(params: unknown[]): unknown[] {
  return params.map(param => {
    // Don't log sensitive data
    if (typeof param === 'string') {
      if (param.includes('password') || param.includes('token') || param.includes('secret')) {
        return '[REDACTED]';
      }
      // Truncate long strings
      if (param.length > 100) {
        return param.substring(0, 100) + '...';
      }
    }
    return param;
  });
}

/**
 * Wrapper for database queries with automatic monitoring
 */
export function createMonitoredQuery<TArgs extends any[], TResult>(
  queryName: string,
  queryFn: (...args: TArgs) => Promise<TResult>
) {
  return async (...args: TArgs): Promise<TResult> => {
    return monitorQuery(queryName, () => queryFn(...args), args);
  };
}

/**
 * Get query performance recommendations
 */
export function getQueryOptimizationTips(queryName: string, duration: number): string[] {
  const tips: string[] = [];
  
  if (duration > VERY_SLOW_QUERY_THRESHOLD_MS) {
    tips.push('Consider adding an index');
    tips.push('Check if query can be simplified');
    tips.push('Review WHERE clause for optimization');
  }
  
  if (queryName.includes('transaction') && duration > SLOW_QUERY_THRESHOLD_MS) {
    tips.push('Verify transaction indexes exist (business_id, card_id, status)');
    tips.push('Consider pagination for large result sets');
  }
  
  if (queryName.includes('join') || queryName.includes('JOIN')) {
    tips.push('Ensure JOIN columns are indexed');
    tips.push('Consider if JOIN can be avoided with denormalization');
  }
  
  return tips;
}
