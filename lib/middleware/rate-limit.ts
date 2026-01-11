/**
 * Rate Limiting Middleware
 * 
 * Protects API endpoints from abuse and DoS attacks.
 * Uses in-memory store (suitable for single-server deployment).
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting
// For production multi-server: Use Redis or similar distributed store
const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Maximum requests per window
  message?: string;  // Custom error message
}

/**
 * Default rate limit: 100 requests per minute
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests, please try again later',
};

/**
 * Strict rate limit for sensitive endpoints (login, etc.)
 */
export const STRICT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many attempts, please try again later',
};

/**
 * Generous rate limit for high-volume endpoints (health checks, etc.)
 */
export const GENEROUS_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: 'Rate limit exceeded',
};

/**
 * Get client identifier (IP address or session)
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (behind proxy)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback: Use a combination of headers as identifier
  // In production behind a proxy, headers should provide IP
  const userAgent = request.headers.get('user-agent') || '';
  return `fallback-${userAgent.substring(0, 50)}`;
}

/**
 * Rate limit middleware
 * Returns null if allowed, error response if rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): NextResponse | null {
  const clientId = getClientIdentifier(request);
  const key = `${clientId}:${request.nextUrl.pathname}`;
  const now = Date.now();
  
  // Get or create rate limit entry
  let entry = store[key];
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    store[key] = entry;
  }
  
  // Increment counter
  entry.count++;
  
  // Check if limit exceeded
  if (entry.count > config.max) {
    const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);
    
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: config.message || 'Too many requests',
        retryAfter: resetInSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': resetInSeconds.toString(),
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': entry.resetTime.toString(),
        },
      }
    );
  }
  
  // Not rate limited - return null
  return null;
}

/**
 * Add rate limit headers to successful responses
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): NextResponse {
  const clientId = getClientIdentifier(request);
  const key = `${clientId}:${request.nextUrl.pathname}`;
  const entry = store[key];
  
  if (entry) {
    const remaining = Math.max(0, config.max - entry.count);
    
    response.headers.set('X-RateLimit-Limit', config.max.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', entry.resetTime.toString());
  }
  
  return response;
}
