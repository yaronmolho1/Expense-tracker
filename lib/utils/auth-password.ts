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
