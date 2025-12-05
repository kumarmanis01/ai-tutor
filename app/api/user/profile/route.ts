import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/db';
import { SessionUser } from '@/lib/types';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/user/profile', 'GET');
  const session = await getServerSessionForHandlers();
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
    // include student-specific fields so clients can detect incomplete profiles
    grade: savedUser?.grade ?? null,
    board: savedUser?.board ?? null,
    subjects: savedUser?.subjects ?? [],
    createdAt: savedUser?.createdAt ?? null,
    role: savedUser?.role ?? '',
    parentEmail: savedUser?.parentEmail ?? '',
    plan: activeSub?.plan ?? '',
    billingCycle: activeSub?.billingCycle ?? '',
    subscriptionEnd: activeSub?.endDate ?? null,
  });
}
