// app/api/profile/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SessionUser } from '@/lib/types';

/**
 * GET -> returns { language, lastChats: [] } for logged-in user, or default language for guests
 * POST -> update preferred language (requires login)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;
  if (!sessionUser || !sessionUser.email) {
    return NextResponse.json({ language: 'en', lastChats: [] });
  }

  const savedUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: { chats: { take: 10, orderBy: { createdAt: 'desc' } } },
  });

  return NextResponse.json({
    language: savedUser?.language ?? 'en',
    lastChats: savedUser?.chats ?? [],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;

  if (!sessionUser || !sessionUser.email)
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { language } = await req.json();
  await prisma.user.update({
    where: { email: sessionUser.email },
    data: { language },
  });

  return NextResponse.json({ ok: true });
}
