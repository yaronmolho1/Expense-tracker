/**
 * Password Utilities (Server-only)
 *
 * These functions use bcrypt which requires Node.js runtime.
 * They cannot be used in Edge Runtime (middleware/proxy).
 * Import from '@/lib/utils/auth' for JWT functions that work everywhere.
 */

import bcrypt from 'bcrypt';

/**
 * Hash password with bcrypt
 * Uses lower rounds in test/CI for speed, production-level security otherwise
 */
export async function hashPassword(password: string): Promise<string> {
  // Use 4 rounds in test (fast), 12 rounds in production (secure)
  // 4 rounds: ~10ms, 12 rounds: ~300ms
  const saltRounds = process.env.NODE_ENV === 'test' || process.env.CI === 'true' ? 4 : 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
