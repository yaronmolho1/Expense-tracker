/**
 * Authentication Utilities (Edge-compatible)
 *
 * Provides JWT-based authentication with multi-tenant foundation.
 * Designed to support future expansion to multiple users per tenant.
 * Uses 'jose' library for Edge Runtime compatibility.
 *
 * NOTE: Password hashing functions (hashPassword, verifyPassword) are in
 * '@/lib/utils/auth-password' to keep this file Edge Runtime compatible.
 */

import * as jose from 'jose';

// JWT secret from environment (required)
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.warn('JWT_SECRET environment variable is not set - authentication will fail');
}

// Encode secret for jose
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

// Parse duration string (e.g., '7d', '1h', '30m') to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60; // Default: 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 7 * 24 * 60 * 60;
  }
}

// User payload in JWT token
export interface JWTPayload {
  userId: string;
  tenantId?: string; // For future multi-tenant support
  email?: string;
  iat?: number;
  exp?: number;
}

// Auth result returned to API routes
export interface AuthUser {
  userId: string;
  tenantId?: string;
  email?: string;
}

/**
 * Generate JWT token for user
 */
export async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const expiresIn = parseDuration(JWT_EXPIRES_IN);

  return new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getSecretKey());
}

/**
 * Verify and decode JWT token
 * @throws Error if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());
    return payload as unknown as JWTPayload;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new Error('Token expired');
    }
    if (error instanceof jose.errors.JWTInvalid || error instanceof jose.errors.JWSSignatureVerificationFailed) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');

  if (authHeader) {
    // Bearer token format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }

  // Fallback to cookie for browser navigation
  const cookie = request.headers.get('cookie');
  if (cookie) {
    const match = cookie.match(/auth_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get current authenticated user from request
 * Returns null if not authenticated (for optional auth routes)
 */
export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  const token = extractToken(request);

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token);
    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 * Use this in API routes that require auth
 */
export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// Password functions moved to '@/lib/utils/auth-password' for Edge Runtime compatibility
// Import { hashPassword, verifyPassword } from '@/lib/utils/auth-password' in API routes

/**
 * Get default user ID for development/single-user mode
 * In production, this should come from JWT token
 */
export function getDefaultUserId(): string {
  // For backward compatibility with existing data
  return 'default-user';
}

/**
 * Extract user ID from request (with fallback to default)
 * Use this during migration period to maintain backward compatibility
 */
export async function getUserId(request: Request): Promise<string> {
  const user = await getCurrentUser(request);
  return user?.userId || getDefaultUserId();
}
