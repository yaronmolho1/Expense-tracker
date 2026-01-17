/**
 * Next.js 16 Proxy - Route Protection
 * (Previously called "middleware" in Next.js 15 and earlier)
 * 
 * Protects API routes and dashboard pages with JWT authentication.
 * Allows public access to login page and auth endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/utils/auth';

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',
];

// Check if path matches public routes
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
}

// Next.js 16 requires the function to be named "proxy"
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Skip proxy for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Extract and verify token
  const token = extractToken(request);

  if (!token) {
    // Redirect to login for dashboard pages
    if (!pathname.startsWith('/api')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Return 401 for API routes
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify token
  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';

    // Redirect to login for dashboard pages
    if (!pathname.startsWith('/api')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }

    // Return 401 for API routes
    return NextResponse.json(
      { error: 'Unauthorized', message },
      { status: 401 }
    );
  }
}

// Configure which routes to run proxy on
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
