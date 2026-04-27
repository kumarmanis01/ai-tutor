import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
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

  // Centralized protected prefixes
  const protectedUiPrefixes = ['/dashboard', '/profile', '/rooms', '/parent', '/learn', '/session'];

  // Admin route protection (UI and API) - requires role
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const publicAdminUi = pathname === '/admin/login' || pathname === '/admin/setup';
    if (publicAdminUi) {
      const passthrough = NextResponse.next();
      passthrough.headers.set('x-pathname', pathname);
      return passthrough;
    }

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
          return NextResponse.redirect(
            new URL(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`, request.url)
          );
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Under-13 gate: block access until parent phone is verified.
      if (
        (token as any).accountStatus === 'pending_parent_verification' &&
        !pathname.startsWith('/dashboard') &&
        !pathname.startsWith('/profile')
      ) {
        return NextResponse.redirect(new URL('/dashboard?parent_verify=1', request.url));
      }

      if (
        !token.onboardingComplete &&
        !pathname.startsWith('/profile') &&
        !pathname.startsWith('/dashboard') &&
        !pathname.startsWith('/parent')
      ) {
        return NextResponse.redirect(new URL('/dashboard?onboarding=1', request.url));
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
  matcher: [
    '/session/:path*',
    '/api/:path*',
    '/admin/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/rooms/:path*',
    '/parent/:path*',
    '/learn/:path*',
    '/student/:path*',
  ],
};
