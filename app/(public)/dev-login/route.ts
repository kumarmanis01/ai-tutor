import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  // Security guard 1: only available when ENABLE_DEV_LOGIN=1 is explicitly set
  if (process.env.ENABLE_DEV_LOGIN !== '1') {
    return new NextResponse('Not found', { status: 404 });
  }

  // Security guard 2: hard block in production regardless of the flag
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  // Fail fast when NEXTAUTH_SECRET is not configured — never use a fallback
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'NEXTAUTH_SECRET is not configured — refusing to mint session cookie' },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('email') || url.searchParams.get('user');
  if (!email)
    return NextResponse.json(
      { error: 'email required (use ?email=you@host or ?user=you@host)' },
      { status: 400 }
    );

  // Find user by email (do not create users implicitly in this route)
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  // Build token payload similar to next-auth jwt callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-auth token shape is not fully typed
  const token: any = {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    role: user.role ?? null,
  };

  // Encode JWT using next-auth utility so cookie matches next-auth expectations
  const encoded = await encode({ token, secret });

  const res = NextResponse.redirect(new URL('/dashboard', req.url));

  // Set NextAuth session cookie (non-https dev environment)
  const cookieName = 'next-auth.session-token';
  res.cookies.set(cookieName, String(encoded), {
    httpOnly: true,
    secure: false,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
