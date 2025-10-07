import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SessionUser } from '@/lib/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;
  if (!sessionUser || !sessionUser.email) {
    return NextResponse.json({
      language: 'en',
      lastChats: [],
      country: '',
      grade: '',
      parentEmail: '',
    });
  }

  const savedUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: { chats: { take: 10, orderBy: { createdAt: 'desc' } } },
  });

  return NextResponse.json({
    language: savedUser?.language ?? 'en',
    lastChats: savedUser?.chats ?? [],
    country: savedUser?.country ?? '',
    grade: savedUser?.grade ?? '',
    parentEmail: savedUser?.parentEmail ?? '',
  });
}
