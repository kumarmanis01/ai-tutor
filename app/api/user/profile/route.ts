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
      name: '',
      email: '',
      country: '',
      language: 'en',
      createdAt: null,
      role: '',
      parentEmail: '',
      plan: '',
      billingCycle: '',
      subscriptionEnd: null,
    });
  }

  const savedUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: {
      subscriptions: true,
    },
  });

  // Find active subscription
  const activeSub = savedUser?.subscriptions?.find((sub: { active: boolean }) => sub.active);

  return NextResponse.json({
    name: savedUser?.name ?? '',
    email: savedUser?.email ?? '',
    country: savedUser?.country ?? '',
    language: savedUser?.language ?? 'en',
    createdAt: savedUser?.createdAt ?? null,
    role: savedUser?.role ?? '',
    parentEmail: savedUser?.parentEmail ?? '',
    plan: activeSub?.plan ?? '',
    billingCycle: activeSub?.billingCycle ?? '',
    subscriptionEnd: activeSub?.endDate ?? null,
  });
}
