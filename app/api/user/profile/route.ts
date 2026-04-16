/**
 * FILE OBJECTIVE:
 * - API handlers for reading and updating the current user's profile.
 *   Supports GET (read canonical profile) and PATCH (update learningStyle).
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/user/profile/learningStyle.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | export VALID_LEARNING_STYLES for unit tests
 */

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
      userBadges: {
        include: {
          badge: { select: { name: true, description: true, icon: true } },
        },
        orderBy: { earnedAt: 'desc' },
      },
    },
  });

  // Find active subscription
  const activeSub = savedUser?.subscriptions?.find((sub: { active: boolean }) => sub.active);

  res = NextResponse.json({
    id: savedUser?.id ?? '',
    name: savedUser?.name ?? '',
    email: savedUser?.email ?? '',
    country: savedUser?.country ?? '',
    language: savedUser?.language ?? 'en',
    // include student-specific fields so clients can detect incomplete profiles
    grade: savedUser?.grade ?? null,
    board: savedUser?.board ?? null,
    schoolName: savedUser?.schoolName ?? null,
    subjects: savedUser?.subjects ?? [],
    age: savedUser?.age ?? null,
    parentPhone: savedUser?.parentPhone ?? null,
    parentPhoneVerifiedAt: savedUser?.parentPhoneVerifiedAt ?? null,
    accountStatus: (savedUser as any)?.accountStatus ?? 'active',
    learningStyle: (savedUser as any)?.learningStyle ?? null,
    createdAt: savedUser?.createdAt ?? null,
    role: savedUser?.role ?? '',
    parentEmail: savedUser?.parentEmail ?? '',
    plan: activeSub?.plan ?? '',
    billingCycle: activeSub?.billingCycle ?? '',
    subscriptionEnd: activeSub?.endDate ?? null,
    // Engagement & cosmetic fields
    currentStreak: (savedUser as any)?.currentStreak ?? 0,
    longestStreak: (savedUser as any)?.longestStreak ?? 0,
    cosmeticUnlocks: (savedUser as any)?.cosmeticUnlocks ?? [],
    userBadges: savedUser?.userBadges ?? [],
  });
  logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'GET' }, start);
  return res;
}

export const VALID_LEARNING_STYLES = ['visual', 'verbal', 'practice', 'mixed'] as const;

export async function PATCH(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  let res: Response;
  if (!session) {
    res = new Response('Unauthorized', { status: 401 });
    logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
    return res;
  }

  const userId = (session.user as SessionUser & { id?: string })?.id;
  if (!userId) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));

  // Only learningStyle is patchable via this endpoint.
  // grade/board are immutable after first save -- strip from all PATCH handlers.
  const rawStyle = typeof body.learningStyle === 'string' ? body.learningStyle.trim() : null;
  if (!rawStyle || !VALID_LEARNING_STYLES.includes(rawStyle as (typeof VALID_LEARNING_STYLES)[number])) {
    res = NextResponse.json(
      { error: `learningStyle must be one of: ${VALID_LEARNING_STYLES.join(', ')}` },
      { status: 400 },
    );
    logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
    return res;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { learningStyle: rawStyle },
    select: { id: true },
  });

  res = NextResponse.json({ ok: true, learningStyle: rawStyle });
  logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
  return res;
}
