/**
 * POST /api/auth/login
 * 
 * Authenticate user with username/password and return JWT token.
 * Simple single-user authentication with expansion for multi-user.
 * 
 * Rate limited: 5 attempts per minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateToken } from '@/lib/utils/auth';
import { verifyPassword } from '@/lib/utils/auth-password';
import { checkRateLimit, STRICT_RATE_LIMIT } from '@/lib/middleware/rate-limit';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-handler';
import logger from '@/lib/logger';

// Validation schema
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  // SOLUTION: Use Base64 encoding to avoid $ characters in .env files
  // This works with Turbopack without issues
  const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
  const AUTH_PASSWORD_HASH_BASE64 = process.env.AUTH_PASSWORD_HASH_BASE64;
  
  // Decode Base64 to get the actual bcrypt hash
  const AUTH_PASSWORD_HASH = AUTH_PASSWORD_HASH_BASE64 
    ? Buffer.from(AUTH_PASSWORD_HASH_BASE64, 'base64').toString('utf-8')
    : undefined;
  // Apply strict rate limiting (5 attempts per minute)
  const rateLimitResponse = checkRateLimit(request, STRICT_RATE_LIMIT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();

    // Validate request body
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return createValidationErrorResponse(
        validated.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        'Login validation failed'
      );
    }

    const { username, password } = validated.data;

    // Verify username
    if (username !== AUTH_USERNAME) {
      logger.warn({ username }, 'Failed login attempt - invalid username');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    if (!AUTH_PASSWORD_HASH) {
      logger.error('AUTH_PASSWORD_HASH not configured');
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      );
    }

    const isValidPassword = await verifyPassword(password, AUTH_PASSWORD_HASH);
    if (!isValidPassword) {
      logger.warn({ username }, 'Failed login attempt - invalid password');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = await generateToken({
      userId: 'default-user', // For now, single user
      email: username,
      // Future: Add tenantId for multi-tenant support
    });

    logger.info({ username }, 'Successful login');

    // Create response with token
    const response = NextResponse.json({
      token,
      user: {
        id: 'default-user',
        username,
      },
    });

    // Set auth cookie so proxy can validate subsequent requests
    // Use secure flag only if request is over HTTPS (not just production)
    const isHttps = request.headers.get('x-forwarded-proto') === 'https' || 
                    request.url.startsWith('https://');
    
    response.cookies.set('auth_token', token, {
      httpOnly: false, // Allow client-side access for API calls
      secure: isHttps, // Only secure if actually using HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;

  } catch (error) {
    return createErrorResponse(error, 500);
  }
}
