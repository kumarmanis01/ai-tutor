import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;

    // Protect dashboard routes
    if (pathname.startsWith('/dashboard')) {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (!token) {
        const signInUrl = new URL('/auth/get-started', req.url);
        signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + (req.nextUrl.search || ''));
        return NextResponse.redirect(signInUrl);
      }
    }
  } catch (err) {
    // Best-effort: on middleware failures, allow the request so we don't block
    // the site. Log the error server-side if logger is available.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { logger } = require('./lib/logger');
      logger.warn('middleware.auth failed', { className: 'middleware', methodName: 'middleware', error: String(err) });
    } catch {}
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
