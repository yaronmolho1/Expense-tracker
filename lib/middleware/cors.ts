/**
 * CORS Middleware Configuration
 * 
 * Configures Cross-Origin Resource Sharing for API endpoints.
 * Production: Only allow frontend domain
 * Development: Allow localhost
 */

import { NextResponse } from 'next/server';

const PRODUCTION_ORIGINS = [
  process.env.NEXTAUTH_URL,
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(): string[] {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_ORIGINS;
  }
  return DEVELOPMENT_ORIGINS;
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return true; // Same-origin requests have no origin header
  }
  
  const allowedOrigins = getAllowedOrigins();
  
  // Allow all origins in development if no specific origins configured
  if (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) {
    return true;
  }
  
  return allowedOrigins.includes(origin);
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  response: NextResponse,
  request: Request
): NextResponse {
  const origin = request.headers.get('origin');
  
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all in development
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return response;
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptionsRequest(request: Request): NextResponse {
  const response = NextResponse.json(null, { status: 204 });
  return addCorsHeaders(response, request);
}
