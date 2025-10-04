import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin route protection
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Onboarding enforcement for authenticated users
  // const protectedPaths = ['/', '/dashboard', '/profile'];
  // const isProtected = protectedPaths.some(
  //   (path) => pathname === path || pathname.startsWith(`${path}/`),
  // );

  // // Only redirect on GET requests to avoid interfering with POST (e.g., onboarding form submission)
  // if (isProtected && request.method === 'GET') {
  //   const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  //   if (token && (!token.parentEmail || !token.name)) {
  //     if (!pathname.startsWith('/onboarding')) {
  //       return NextResponse.redirect(new URL('/onboarding', request.url));
  //     }
  //   }
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/', '/dashboard/:path*', '/profile/:path*', '/onboarding'],
};
