import { NextResponse } from 'next/server';

/**
 * GET /logout
 * - Clears the NextAuth session cookie(s) by redirecting through NextAuth's
 *   built-in sign-out endpoint with an explicit callbackUrl of /.
 *
 * Preferred over client-side signOut() to avoid hydration mismatch and to
 * ensure the redirect works correctly for both authenticated and
 * unauthenticated visitors.
 */
export async function GET() {
  // NextAuth's /api/auth/signout?callbackUrl=/ handles cookie clearing.
  // Using a 302 redirect keeps the request cycle server-side.
  return NextResponse.redirect(
    new URL(
      '/api/auth/signout?callbackUrl=%2F',
      process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    ),
    { status: 302 }
  );
}
