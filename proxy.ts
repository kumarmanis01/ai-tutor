/**
 * FILE OBJECTIVE:
 * - Apply authentication and route canonicalization for protected UI and API paths
 *   using the Next.js proxy file convention.
 *
 * LINKED UNIT TEST:
 * - tests/auto/proxy.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | copilot | migrate route guard from middleware convention to proxy convention
 * - 2026-05-12T00:00:00Z | copilot | enforce active-account guard for /student and /parent routes with onboarding allowlist
 * - 2026-05-07T00:00:00Z | copilot | remove stale JWT-based onboarding redirects for /session routes
 * - 2026-05-08T00:00:00Z | copilot | enforce auth guard for /student/* paths and redirect unauthenticated requests to /
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/lib/logger';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Legacy /session/[sessionId] -> redirect to /session/[topicId] (canonical route)
  const sessionMatch = pathname.match(/^\/session\/([^/]+)$/);
  if (sessionMatch) {
    const segment = sessionMatch[1];
    try {
      const base = request.nextUrl.origin;
      const res = await fetch(`${base}/api/session/lookup?id=${encodeURIComponent(segment)}`, {
        headers: request.headers.get('cookie') ? { cookie: request.headers.get('cookie') } : {},
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.topicId && body.topicId !== segment) {
          return NextResponse.redirect(new URL(`/session/${body.topicId}`, request.url), 307);
        }
      }
    } catch {
      // On lookup failure, continue so [topicId] page can handle or show error.
    }
  }

  const isApiRoute = pathname.startsWith('/api/');
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
  if (isApiRoute && isDev) {
    const method = request.method;
    logger.info(`[API] ${method} ${pathname} called`);
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const clone = request.clone();
        const body = await clone.text();
        if (body) {
          logger.debug(`[API] ${method} ${pathname} body: ${body}`);
        }
      } catch {
        // Best-effort development logging only.
      }
    }
  }

  const protectedUiPrefixes = ['/dashboard', '/profile', '/rooms', '/parent', '/learn', '/session', '/student'];

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // Admin login is public -- pass through so the page can render.
    if (pathname === '/admin/login') {
      const response = NextResponse.next();
      response.headers.set('x-pathname', pathname);
      return response;
    }

    logger.debug('[PROXY] Token: ' + String(token));
    const allowed = token && (token.role === 'admin' || token.role === 'moderator');
    if (!allowed) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Redirect unauthenticated admin UI to the admin login page.
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  for (const prefix of protectedUiPrefixes) {
    if (pathname.startsWith(prefix)) {
      if (!token) {
        if (prefix === '/session') {
          return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`, request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      const isStudentOrParentUi = pathname.startsWith('/student') || pathname.startsWith('/parent');
      const accountStatus = (token as { accountStatus?: string }).accountStatus;
      if (isStudentOrParentUi && accountStatus !== 'active') {
        const isParent = (token as { role?: string }).role === 'parent';
        // Parent-role users don't go through student onboarding. Once the JWT carries
        // role=parent, allow them through /parent/* regardless of accountStatus --
        // set-role sets accountStatus=active in the DB but the JWT cookie may lag
        // by one request cycle after invalidation.
        if (isParent && pathname.startsWith('/parent')) {
          const allowed = NextResponse.next();
          allowed.headers.set('x-pathname', pathname);
          return allowed;
        }
        const onboardingTarget = isParent ? '/parent/onboarding' : '/student/onboarding';
        if (
          pathname.startsWith('/student/onboarding') ||
          pathname.startsWith('/student/verify-parent') ||
          pathname.startsWith('/parent/onboarding')
        ) {
          const allowed = NextResponse.next();
          allowed.headers.set('x-pathname', pathname);
          return allowed;
        }
        return NextResponse.redirect(new URL(onboardingTarget, request.url));
      }

      const response = NextResponse.next();
      response.headers.set('x-pathname', pathname);
      return response;
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: ['/session/:path*', '/api/:path*', '/admin/:path*', '/dashboard/:path*', '/profile/:path*', '/rooms/:path*', '/parent/:path*', '/learn/:path*', '/student/:path*'],
};