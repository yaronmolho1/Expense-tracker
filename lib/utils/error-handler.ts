/**
 * Error Handler Utilities
 * 
 * Sanitizes errors for production responses.
 * Prevents leaking sensitive information in error messages.
 */

import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  requestId?: string;
}

/**
 * Sanitize error for production response
 * Removes stack traces and sensitive details
 */
export function sanitizeError(error: unknown): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (error instanceof Error) {
    return {
      error: error.name || 'Error',
      message: error.message,
      // Only include stack trace in development
      ...(isDevelopment && error.stack && { details: error.stack }),
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      error: 'Error',
      message: error,
    };
  }
  
  // Handle objects with error property
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as any;
    return {
      error: errorObj.error || errorObj.name || 'Error',
      message: errorObj.message || 'An error occurred',
      ...(isDevelopment && errorObj.details && { details: errorObj.details }),
    };
  }
  
  // Generic fallback
  return {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  };
}

/**
 * Create error response with sanitization
 */
export function createErrorResponse(
  error: unknown,
  status: number = 500,
  requestId?: string
): NextResponse {
  // Log the full error (with sensitive details)
  logger.error(error, `API Error (${status})`);
  
  // Sanitize error for response
  const sanitized = sanitizeError(error);
  
  // Add request ID if provided
  if (requestId) {
    sanitized.requestId = requestId;
  }
  
  // In production, use generic messages for 500 errors
  if (process.env.NODE_ENV === 'production' && status === 500) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.',
        requestId,
      },
      { status }
    );
  }
  
  return NextResponse.json(sanitized, { status });
}

/**
 * Handle validation errors (400)
 */
export function createValidationErrorResponse(
  details: any,
  message: string = 'Validation failed'
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation Error',
      message,
      details,
    },
    { status: 400 }
  );
}

/**
 * Handle authentication errors (401)
 */
export function createAuthErrorResponse(
  message: string = 'Authentication required'
): NextResponse {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message,
    },
    { status: 401 }
  );
}

/**
 * Handle authorization errors (403)
 */
export function createForbiddenErrorResponse(
  message: string = 'Access denied'
): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message,
    },
    { status: 403 }
  );
}

/**
 * Handle not found errors (404)
 */
export function createNotFoundErrorResponse(
  resource: string = 'Resource'
): NextResponse {
  return NextResponse.json(
    {
      error: 'Not Found',
      message: `${resource} not found`,
    },
    { status: 404 }
  );
}

/**
 * Handle conflict errors (409)
 */
export function createConflictErrorResponse(
  message: string = 'Resource conflict'
): NextResponse {
  return NextResponse.json(
    {
      error: 'Conflict',
      message,
    },
    { status: 409 }
  );
}

/**
 * Generate unique request ID for error tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
