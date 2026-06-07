/**
 * FILE OBJECTIVE:
 * - Route-level auth guard for /admin/*. Redirects unauthenticated visitors
 *   (or signed-in non-admins) to /admin/login, and bounces signed-in admins
 *   away from the admin auth pages back to /admin.
 *
 * NOTE: Defense-in-depth only -- app/admin/layout.tsx still verifies the
 * session server-side before rendering any privileged content.
 *
 * LINKED UNIT TEST:
 * - tests/unit/middleware.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | create middleware to redirect unauthenticated /admin visitors to /admin/login and
 *     bounce signed-in admins away from the auth pages
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const ADMIN_AUTH_PATHS = new Set<string>([
  '/admin/login',
  '/admin/signup',
  '/admin/forgot-password',
  '/admin/reset-password',
]);

function isAdminAuthPath(pathname: string): boolean {
  return ADMIN_AUTH_PATHS.has(pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAdmin = token?.role === 'admin';

  if (isAdminAuthPath(pathname)) {
    if (isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
