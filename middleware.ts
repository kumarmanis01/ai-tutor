/**
 * FILE OBJECTIVE:
 * - Apply authentication and route canonicalization for protected UI and API paths
 *   without duplicating stale onboarding or parent-verification redirects.
 *
 * LINKED UNIT TEST:
 * - tests/auto/middleware.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | remove stale JWT-based onboarding redirects for /session routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/lib/logger';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Legacy /session/[sessionId] → redirect to /session/[topicId] (canonical route)
  const sessionMatch = pathname.match(/^\/session\/([^/]+)$/);
  if (sessionMatch) {
    const segment = sessionMatch[1];
    try {
      const base = request.nextUrl.origin;
      const res = await fetch(`${base}/api/session/lookup?id=${encodeURIComponent(segment)}`, {
        headers: request.headers.get('cookie') ? { cookie: request.headers.get('cookie')! } : {},
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.topicId && body.topicId !== segment) {
          return NextResponse.redirect(new URL(`/session/${body.topicId}`, request.url), 307);
        }
      }
    } catch {
      // On lookup failure, continue so [topicId] page can handle or show error
    }
  }

  // Centralized API request logging (dev only)
  const isApiRoute = pathname.startsWith('/api/');
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
  if (isApiRoute && isDev) {
    const method = request.method;
    logger.info(`[API] ${method} ${pathname} called`);
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const clone = request.clone();
        const body = await clone.text();
        if (body) logger.debug(`[API] ${method} ${pathname} body: ${body}`);
      } catch {}
    }
  }

  // Centralized protected prefixes
  const protectedUiPrefixes = ['/dashboard', '/profile', '/rooms', '/parent', '/learn', '/session'];

  // Admin route protection (UI and API) - requires role
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    logger.debug('[MIDDLEWARE] Token: ' + String(token));
    const allowed = token && (token.role === 'admin' || token.role === 'moderator');
    if (!allowed) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Generic UI protection for other prefixes: redirect to root if no valid token
  for (const prefix of protectedUiPrefixes) {
    if (pathname.startsWith(prefix)) {
      if (!token) {
        if (prefix === '/session') {
          return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`, request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      const res = NextResponse.next();
      res.headers.set('x-pathname', pathname);
      return res;
    }
  }

  const res = NextResponse.next();
  res.headers.set('x-pathname', pathname);
  return res;
}

export const config = {
  matcher: ['/session/:path*', '/api/:path*', '/admin/:path*', '/dashboard/:path*', '/profile/:path*', '/rooms/:path*', '/parent/:path*', '/learn/:path*', '/student/:path*'],
};
