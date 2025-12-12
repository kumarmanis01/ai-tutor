import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  let res: Response;
  if (!session) {
    res = new Response('Unauthorized', { status: 401 });
    logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'GET' }, start);
    return res;
  }

  const sessionUser = session.user as SessionUser;
  if (!sessionUser || !sessionUser.email) {
    res = NextResponse.json({
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
    logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'GET' }, start);
    return res;
  }

  const savedUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: {
      subscriptions: true,
    },
  });

  // Find active subscription
  const activeSub = savedUser?.subscriptions?.find((sub: { active: boolean }) => sub.active);

  res = NextResponse.json({
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
  logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'GET' }, start);
  return res;
}
