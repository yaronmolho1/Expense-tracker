/**
 * Authentication Utilities
 * 
 * Provides JWT-based authentication with multi-tenant foundation.
 * Designed to support future expansion to multiple users per tenant.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// JWT secret from environment (required)
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.warn('JWT_SECRET environment variable is not set - authentication will fail');
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
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  // Type assertion needed due to jsonwebtoken library types
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions) as string;
}

/**
 * Verify and decode JWT token
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
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
export function getCurrentUser(request: Request): AuthUser | null {
  const token = extractToken(request);
  
  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
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
export function requireAuth(request: Request): AuthUser {
  const user = getCurrentUser(request);
  
  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

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
export function getUserId(request: Request): string {
  const user = getCurrentUser(request);
  return user?.userId || getDefaultUserId();
}
