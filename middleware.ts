import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Sets x-pathname header so server-component layouts can detect the current route
// without needing client-side hooks (usePathname is client-only).
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
