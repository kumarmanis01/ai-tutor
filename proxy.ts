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
 * - 2026-06-07T00:00:00Z | claude | add role-based cross-dashboard guard: active parent hitting /dashboard or
 *     /student/* redirected to /parent/dashboard; active student hitting /parent/* redirected to /dashboard;
 *     fix inactive-account onboarding destination to be role-aware (/parent/onboarding for parents)
 * - 2026-06-07T00:00:00Z | claude | wire admin auth flow: redirect unauthenticated /admin visitors to /admin/login
 *     (was /), bounce signed-in admins away from /admin/login|signup|forgot-password|reset-password back to /admin,
 *     and allow /api/admin/auth/* through unauthenticated for the signup/forgot/reset endpoints
 * - 2026-05-19T00:00:00Z | copilot | migrate route guard from middleware convention to proxy convention
 * - 2026-05-12T00:00:00Z | copilot | enforce active-account guard for /student and /parent routes with onboarding allowlist
 * - 2026-05-07T00:00:00Z | copilot | remove stale JWT-based onboarding redirects for /session routes
 * - 2026-05-08T00:00:00Z | copilot | enforce auth guard for /student/* paths and redirect unauthenticated requests to /
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/lib/logger';

// Admin auth pages that must remain reachable without an admin session and
// must bounce already-signed-in admins back to /admin.
const ADMIN_AUTH_PATHS = new Set<string>([
  '/admin/login',
  '/admin/signup',
  '/admin/forgot-password',
  '/admin/reset-password',
]);

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
    logger.debug('[PROXY] Token: ' + String(token));
    const allowed = token && (token.role === 'admin' || token.role === 'moderator');
    const isAdminAuthApi = pathname.startsWith('/api/admin/auth/');
    const isAdminAuthPage = ADMIN_AUTH_PATHS.has(pathname);

    // /api/admin/auth/* (signup, forgot-password, reset-password) must be
    // reachable without an admin session -- they exist precisely to bootstrap
    // one. They have their own gating (ADMIN_SIGNUP_CODE, token consumption).
    if (isAdminAuthApi) {
      return NextResponse.next();
    }

    // /admin/login, /admin/signup, /admin/forgot-password, /admin/reset-password:
    // bounce signed-in admins to /admin, otherwise allow unauthenticated access.
    if (isAdminAuthPage) {
      if (allowed) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    if (!allowed) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

  for (const prefix of protectedUiPrefixes) {
    if (pathname.startsWith(prefix)) {
      if (!token) {
        if (prefix === '/session') {
          return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`, request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      const tokenRole = (token as { role?: string }).role;
      const isStudentOrParentUi = pathname.startsWith('/student') || pathname.startsWith('/parent');
      const accountStatus = (token as { accountStatus?: string }).accountStatus;
      if (isStudentOrParentUi && accountStatus !== 'active') {
        // Onboarding allowlist: each role may only pass through their own onboarding
        // path. A parent must not reach /student/onboarding and a student must not
        // reach /parent/onboarding even while their account is inactive.
        const isOnboardingAllowlist =
          (tokenRole !== 'parent' &&
            (pathname.startsWith('/student/onboarding') || pathname.startsWith('/student/verify-parent'))) ||
          (tokenRole === 'parent' && pathname.startsWith('/parent/onboarding'));
        if (isOnboardingAllowlist) {
          const allowed = NextResponse.next();
          allowed.headers.set('x-pathname', pathname);
          return allowed;
        }
        // Route inactive users to their role-appropriate onboarding destination.
        const onboardingDest = tokenRole === 'parent' ? '/parent/onboarding' : '/student/onboarding';
        return NextResponse.redirect(new URL(onboardingDest, request.url));
      }

      // Role-based cross-dashboard guard (active accounts only).
      // A parent must never land on /dashboard or /student/* paths, and a student
      // must never land on /parent/* paths. This is the primary enforcement point --
      // all other layers (layout, page guards) are defence-in-depth.
      if (tokenRole === 'parent' && (pathname.startsWith('/dashboard') || pathname.startsWith('/student'))) {
        return NextResponse.redirect(new URL('/parent/dashboard', request.url));
      }
      if (tokenRole === 'user' && pathname.startsWith('/parent')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
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