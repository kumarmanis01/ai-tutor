/**
 * FILE OBJECTIVE:
 * - API handlers for reading and updating the current user's profile.
 *   Supports GET (read canonical profile) and PATCH (update learningStyle).
 *
 * LINKED UNIT TEST:
 * - __tests__/app/api/user/profile/learningStyle.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | export VALID_LEARNING_STYLES for unit tests
 * - 2026-05-04T00:00:00Z | copilot | update header template paths and linked test reference
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { logger } from '@/lib/logger';
import { generateLearningPlan } from '@/lib/ai/learningPlan';

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
    whatsappPhone: savedUser?.whatsappPhone ?? null,
    accountStatus: (savedUser as any)?.accountStatus ?? 'active',
    learningStyle: (savedUser as any)?.learningStyle ?? null,
    preferences: (savedUser as any)?.preferences ?? null,
    createdAt: savedUser?.createdAt ?? null,
    role: savedUser?.role ?? '',
    parentEmail: savedUser?.parentEmail ?? '',
    plan: activeSub?.plan ?? '',
    billingCycle: activeSub?.billingCycle ?? '',
    subscriptionEnd: activeSub?.endDate ?? null,
    // Engagement & cosmetic fields
    level: (savedUser as any)?.level ?? 1,
    totalXp: (savedUser as any)?.totalXp ?? 0,
    currentStreak: (savedUser as any)?.currentStreak ?? 0,
    longestStreak: (savedUser as any)?.longestStreak ?? 0,
    cosmeticUnlocks: (savedUser as any)?.cosmeticUnlocks ?? [],
    userBadges: savedUser?.userBadges ?? [],
  });
  logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'GET' }, start);
  return res;
}

// F-STU-004 AC-06: primary values are visual/reading/kinesthetic (per spec).
// verbal/practice/mixed retained for backwards compatibility with existing student records.
export const VALID_LEARNING_STYLES = ['visual', 'reading', 'kinesthetic', 'verbal', 'practice', 'mixed'] as const;

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

  // Support updating learningStyle and user preferences (partial merge).
  // grade/board/whatsappPhone are immutable after first save -- strip from all PATCH handlers.
  const updates: any = {};
  // whatsappPhone immutable after first save -- strip from all PATCH handlers

  // learningStyle (existing behaviour)
  const rawStyle = typeof body.learningStyle === 'string' ? body.learningStyle.trim() : null;
  if (rawStyle !== null && rawStyle !== '') {
    if (!VALID_LEARNING_STYLES.includes(rawStyle as (typeof VALID_LEARNING_STYLES)[number])) {
      res = NextResponse.json(
        { error: `learningStyle must be one of: ${VALID_LEARNING_STYLES.join(', ')}` },
        { status: 400 },
      );
      logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
      return res;
    }
    updates.learningStyle = rawStyle;
  }

  // preferences: allow partial updates; validate known keys
  if (body.preferences && typeof body.preferences === 'object') {
    const allowedCrunch = ['auto', 'on', 'off'];
    const allowedFont = ['small', 'medium', 'large'];
    const prefsToMerge: any = {};

    if (typeof body.preferences.crunchMode === 'string') {
      if (!allowedCrunch.includes(body.preferences.crunchMode)) {
        res = NextResponse.json({ error: `crunchMode must be one of: ${allowedCrunch.join(', ')}` }, { status: 400 });
        logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
        return res;
      }
      prefsToMerge.crunchMode = body.preferences.crunchMode;
    }

    if (typeof body.preferences.fontSize === 'string') {
      if (!allowedFont.includes(body.preferences.fontSize)) {
        res = NextResponse.json({ error: `fontSize must be one of: ${allowedFont.join(', ')}` }, { status: 400 });
        logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
        return res;
      }
      prefsToMerge.fontSize = body.preferences.fontSize;
    }

    // badgeShowcase: array of badge ids (max 5) - used by ProfileWidgets showcase
    if (body.preferences.badgeShowcase !== undefined) {
      if (!Array.isArray(body.preferences.badgeShowcase)) {
        res = NextResponse.json({ error: 'badgeShowcase must be an array' }, { status: 400 });
        logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
        return res;
      }
      const arr = body.preferences.badgeShowcase as any[];
      if (arr.length > 5) {
        res = NextResponse.json({ error: 'badgeShowcase may contain at most 5 items' }, { status: 400 });
        logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
        return res;
      }
      if (!arr.every((v) => typeof v === 'string')) {
        res = NextResponse.json({ error: 'badgeShowcase must be an array of strings' }, { status: 400 });
        logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
        return res;
      }
      // de-dupe while preserving order
      prefsToMerge.badgeShowcase = Array.from(new Set(arr.map((v) => String(v))));
    }

    if (Object.keys(prefsToMerge).length > 0) {
      // Merge with existing preferences atomically
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
      const merged = { ...(existing?.preferences as any || {}), ...prefsToMerge };
      updates.preferences = merged;
    }
  }

  // Support updating examDate (optional). Accepts an ISO string or null to clear.
  if (Object.prototype.hasOwnProperty.call(body, 'examDate')) {
    const raw = (body as any).examDate
    if (raw === null) {
      updates.examDate = null
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) {
        res = NextResponse.json({ error: 'Invalid examDate' }, { status: 400 })
        if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start)
        return res
      }
      updates.examDate = parsed
    } else {
      res = NextResponse.json({ error: 'Invalid examDate' }, { status: 400 })
      if (typeof logger.logAPI === 'function') logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start)
      return res
    }
  }

  if (Object.keys(updates).length === 0) {
    res = NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);
    return res;
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: updates, select: { id: true, learningStyle: true, preferences: true, examDate: true } });

  res = NextResponse.json({ ok: true, learningStyle: updated.learningStyle ?? null, preferences: updated.preferences ?? null });
  logger.logAPI(req, res, { className: 'UserProfileAPI', methodName: 'PATCH' }, start);

  // If examDate was updated, regenerate any existing learning plans for the student (non-blocking).
  if (Object.prototype.hasOwnProperty.call(updates, 'examDate')) {
    const lpModel = (prisma as any).learningPlan
    if (lpModel && typeof lpModel.findMany === 'function') {
      const studentId = updated.id
      const exam = updates.examDate instanceof Date ? updates.examDate : null
      // Lightweight audit/event for observability (fire-and-forget). Attach to student record.
      const eventModel = (prisma as any).event
      if (eventModel && typeof eventModel.create === 'function') {
        eventModel.create({
          data: {
            userId: studentId,
            type: 'examDate.regen.triggered',
            metadata: { triggeredBy: userId ?? null, trigger: 'profile', examDate: exam instanceof Date ? exam.toISOString() : null },
            timestamp: new Date(),
          },
        }).catch((evErr: any) => {
          logger.warn('UserProfileAPI: failed to persist regen event', { className: 'UserProfileAPI', methodName: 'PATCH', error: String(evErr) })
        })
      }
      lpModel
        .findMany({ where: { studentId }, select: { subjectId: true, weeklyGoal: true } })
        .then(async (plans: Array<{ subjectId: string; weeklyGoal: number }>) => {
          if (!plans || plans.length === 0) return
          for (const p of plans) {
            try {
              await generateLearningPlan(studentId, p.subjectId, { examDate: exam ?? undefined, weeklyGoal: p.weeklyGoal })
            } catch (err) {
              logger.warn('UserProfileAPI: regenerate learning plan failed', { className: 'UserProfileAPI', methodName: 'PATCH', studentId, subjectId: p.subjectId, error: String(err) })
            }
          }
        })
        .catch((err: any) => {
          logger.warn('UserProfileAPI: failed to fetch learning plans for regen', { className: 'UserProfileAPI', methodName: 'PATCH', studentId: updated.id, error: String(err) })
        })
    }
  }

  return res;
}
