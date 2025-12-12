import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/lib/logger';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

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

  // Admin route protection
  if (pathname.startsWith('/admin')) {
    // eslint-disable-next-line no-console
    console.log('[MIDDLEWARE DEBUG] Token:', token);
    if (!token || token.role !== 'admin') {
      // Redirect unauthorized users to home page to avoid redirect loop
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Dashboard route protection: require any valid session token
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/dashboard/:path*'],
};
