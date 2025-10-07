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
      country: '',
      grade: '',
      parentEmail: '',
      role: '',
      memberSince: null,
      plan: '',
      billingCycle: '',
    });
  }

  const savedUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: {
      chats: { take: 10, orderBy: { createdAt: 'desc' } },
      subscriptions: true,
    },
  });

  // Find active subscription
  const activeSub = savedUser?.subscriptions?.find((sub) => sub.active);

  return NextResponse.json({
    language: savedUser?.language ?? 'en',
    country: savedUser?.country ?? '',
    grade: savedUser?.grade ?? '',
    parentEmail: savedUser?.parentEmail ?? '',
    role: savedUser?.role ?? '',
    memberSince: savedUser?.createdAt ?? null,
    plan: activeSub?.plan ?? '',
    billingCycle: activeSub?.billingCycle ?? '',
  });
}
