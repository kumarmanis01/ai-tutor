import { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  // Security guard: only available in non-production
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const url = new URL(req.url)
  const email = url.searchParams.get('email') || url.searchParams.get('user')
  if (!email) return NextResponse.json({ error: 'email required (use ?email=you@host or ?user=you@host)' }, { status: 400 })

  // Find user by email (do not create users implicitly in this route)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, image: true, role: true } })
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  // Build token payload similar to next-auth jwt callback
  const token: any = {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    role: user.role ?? null,
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET || 'dev-secret'

  // Encode JWT using next-auth utility so cookie matches next-auth expectations
  const encoded = await encode({ token, secret })

  const res = NextResponse.redirect(new URL('/dashboard', req.url))

  // Set NextAuth session cookie name used in non-https dev environments.
  // Use both common names to increase compatibility with app helpers.
  const cookieName = 'next-auth.session-token'
  res.cookies.set(cookieName, String(encoded), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })

  // Also set __Secure- prefixed cookie when applicable (won't be used in dev)
  if (process.env.NODE_ENV !== 'production') {
    // avoid setting __Secure- cookie in dev if not needed
  }

  return res
}
