/**
 * POST /api/auth/logout
 * 
 * Logout endpoint (stateless JWT - client-side token deletion).
 * Future: Implement token blacklist if needed.
 */

import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST() {
  // For stateless JWT, logout is handled client-side
  // Client should delete the token from localStorage/cookies
  
  logger.info('User logged out');

  // Clear the auth cookie
  const response = NextResponse.json({
    message: 'Logged out successfully',
  });
  
  response.cookies.set('auth_token', '', { 
    maxAge: 0, 
    path: '/' 
  });
  
  return response;
}
