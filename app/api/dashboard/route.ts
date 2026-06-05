/**
 * GET /api/dashboard
 *
 * Consolidated dashboard endpoint. Returns all data needed to render the
 * student home screen in a single round-trip, replacing 8 parallel fetches
 * on the dashboard page.
 *
 * Response shape:
 *   {
 *     primaryAction: PrimaryAction,
 *     weeklyActivity: { days: DayActivity[]; sessionCountThisWeek: number },
 *     streak: { currentStreak: number; longestStreak: number },
 *     weakTopics: WeakTopicItem[],
 *     pendingHomework: HomeworkItem[],
 *     upcomingTopics: UpcomingTopic[],
 *     nudgeMessage: string | null
 *   }
 *
 * primaryAction priority logic (first match wins):
 *   1. Pending/overdue homework exists → type='homework'
 *   2. Active in-progress session exists → type='resume'
 *   3. Otherwise → type='start' using TopicRanker recommendation
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created per UX architecture blueprint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { getWeakTopicsWithNames } from '@/lib/learning/getWeakTopics';
import { getMasteryLabel } from '@/lib/learning/masteryLabel';
import { getNudgeMessage } from '@/lib/dashboard/nudgeMessage';
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// Cache TTL: 60 s. Short enough that streak/homework stay current.
// Key includes a version suffix so shape changes auto-invalidate.
const CACHE_TTL_S = 60;
const cacheKey = (userId: string) => `dash:v1:${userId}`;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_WEEKLY_GOAL = 3;

function getISOWeekBoundaries() {
  const now = new Date();
  const dow = now.getUTCDay();
  const distToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - distToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { monday, sunday };
}

export async function GET(_req: Request) {
  const start = Date.now();

  const authSession = await getServerSessionForHandlers();
  const userId = authSession?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { monday, sunday } = getISOWeekBoundaries();

  try {
    // ── Redis cache check ─────────────────────────────────────────────────
    const cached = await cacheGet<object>(cacheKey(userId));
    if (cached) {
      const res = NextResponse.json(cached);
      res.headers.set('Cache-Control', 'private, max-age=60');
      res.headers.set('X-Cache', 'HIT');
      return res;
    }

    // ── Parallel data fetches ─────────────────────────────────────────────
    const [
      activeSession,
      pendingHomeworkRaw,
      streakRow,
      weeklySessionsRaw,
      learningProfile,
      weakTopicsRaw,
      nextActionResult,
      orderedTopics,
      lastSessionRow,
    ] = await Promise.all([
      // 1. Active in-progress session (latest first)
      isSessionEngineEnabled()
        ? prisma.structuredSession.findFirst({
            where: { studentId: userId, state: { notIn: ['COMPLETE', 'EXPIRED'] } },
            select: {
              id: true,
              state: true,
              topicId: true,
              startedAt: true,
              topic: {
                select: {
                  name: true,
                  chapter: { select: { name: true, subject: { select: { name: true } } } },
                },
              },
            },
            orderBy: { startedAt: 'desc' },
          })
        : Promise.resolve(null),

      // 2. Pending / overdue homework (max 3 to surface on dashboard)
      prisma.homeworkAssignment.findMany({
        where: { studentId: userId, status: { in: ['PENDING', 'OVERDUE'] } },
        select: {
          id: true,
          status: true,
          dueDate: true,
          questions: true,
          topic: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 3,
      }),

      // 3. Study streak
      prisma.studentStreak.findFirst({
        where: { studentId: userId, kind: 'daily' },
        select: { current: true, best: true, lastActive: true },
      }),

      // 4. Sessions this week (for 7-day strip)
      prisma.structuredSession.findMany({
        where: { studentId: userId, startedAt: { gte: monday, lte: sunday } },
        select: { startedAt: true },
      }),

      // 5. Learning profile for weekly goal
      prisma.studentLearningProfile.findFirst({
        where: { studentId: userId },
        select: { studyDaysPerWeek: true },
      }).catch(() => null),

      // 6. Weak topics (max 2 shown on dashboard per UX spec)
      getWeakTopicsWithNames(userId).catch(() => []),

      // 7. Next topic recommendation
      getNextAction(userId).catch(() => null),

      // 8. Ordered topics for upcoming list
      getOrderedTopicsForStudent(userId).catch(() => []),

      // 9. Last session date for nudge calculation
      prisma.structuredSession.findFirst({
        where: { studentId: userId },
        select: { startedAt: true },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    // ── Build weekly activity strip ───────────────────────────────────────
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      return { date: d.toISOString().split('T')[0], dayLabel: DAY_LABELS[i], hasSession: false };
    });
    for (const s of weeklySessionsRaw) {
      const dow = new Date(s.startedAt).getUTCDay();
      const idx = dow === 0 ? 6 : dow - 1;
      if (idx >= 0 && idx < 7) days[idx].hasSession = true;
    }

    // ── Determine primary action type ─────────────────────────────────────
    const oldestPendingHomework = pendingHomeworkRaw[0] ?? null;
    let primaryActionType: 'homework' | 'resume' | 'start';
    if (oldestPendingHomework) {
      primaryActionType = 'homework';
    } else if (activeSession) {
      primaryActionType = 'resume';
    } else {
      primaryActionType = 'start';
    }

    // Unwrap next action (API may return { action } wrapper or direct object)
    const rawAction = nextActionResult && typeof nextActionResult === 'object' && 'action' in nextActionResult
      ? (nextActionResult as { action: unknown }).action
      : nextActionResult;
    const recommendation = rawAction && (rawAction as { topicId?: string }).topicId
      ? (rawAction as { topicId: string; topicName?: string | null; subject?: string | null; chapter?: string | null; estimatedTimeMin?: number })
      : null;

    // ── Build upcoming topics (first 3 un-mastered, excluding current rec) ─
    const recTopicId = recommendation?.topicId;
    const masteredIds = new Set(
      (await prisma.studentTopicProgress.findMany({
        where: { studentId: userId, mastery: { gte: 0.9 } },
        select: { topicId: true },
      })).map((r: any) => r.topicId),
    );
    const upcomingTopics = (orderedTopics as { topicId?: string; id?: string; topicName?: string; name?: string; subject?: string }[])
      .filter((t) => {
        const id = t.topicId ?? t.id;
        return id && id !== recTopicId && !masteredIds.has(id);
      })
      .slice(0, 3)
      .map((t) => ({
        topicId: t.topicId ?? t.id ?? '',
        topicTitle: t.topicName ?? t.name ?? '',
        subject: t.subject ?? '',
      }));

    // ── Nudge message ─────────────────────────────────────────────────────
    const now = new Date();
    const lastSessionDate = lastSessionRow?.startedAt ?? null;
    const daysSince = lastSessionDate
      ? Math.floor((now.getTime() - lastSessionDate.getTime()) / 86_400_000)
      : 99;
    const weeklyGoal = learningProfile?.studyDaysPerWeek ?? DEFAULT_WEEKLY_GOAL;
    const dowNow = now.getUTCDay();
    const daysLeft = dowNow === 0 ? 1 : 7 - dowNow + 1;

    const nudgeMessage = getNudgeMessage({
      daysSinceLastSession: daysSince,
      lastSessionDate,
      pendingHomeworkCount: pendingHomeworkRaw.length,
      sessionsThisWeek: weeklySessionsRaw.length,
      weeklyGoalSessions: weeklyGoal,
      daysLeftInWeek: daysLeft,
    });

    // ── Compose response ──────────────────────────────────────────────────
    const response = {
      primaryAction: {
        type: primaryActionType,
        session: activeSession
          ? {
              sessionId: activeSession.id,
              topicName: activeSession.topic?.name ?? '',
              currentPhase: activeSession.state,
              subject: activeSession.topic?.chapter?.subject?.name ?? '',
              chapter: activeSession.topic?.chapter?.name ?? '',
            }
          : null,
        recommendation: recommendation
          ? {
              topicId: recommendation.topicId,
              topicTitle: recommendation.topicName ?? recommendation.topicId,
              subject: recommendation.subject ?? '',
              chapter: recommendation.chapter ?? '',
              estimatedTimeMin: recommendation.estimatedTimeMin ?? 20,
            }
          : null,
        pendingHomework: oldestPendingHomework
          ? {
              id: oldestPendingHomework.id,
              topicName: oldestPendingHomework.topic?.name ?? '',
              questionCount: Array.isArray(oldestPendingHomework.questions)
                ? (oldestPendingHomework.questions as unknown[]).length
                : 0,
              dueDate: oldestPendingHomework.dueDate.toISOString(),
              status: oldestPendingHomework.status,
            }
          : null,
      },
      weeklyActivity: {
        days,
        sessionCountThisWeek: weeklySessionsRaw.length,
      },
      streak: {
        currentStreak: streakRow?.current ?? 0,
        longestStreak: streakRow?.best ?? 0,
      },
      weakTopics: weakTopicsRaw.slice(0, 2).map((t) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        masteryLabel: getMasteryLabel(t.mastery),
      })),
      pendingHomework: pendingHomeworkRaw.map((h: any) => ({
        id: h.id,
        topicName: h.topic?.name ?? '',
        status: h.status as 'PENDING' | 'OVERDUE',
        dueDate: h.dueDate.toISOString(),
        questionCount: Array.isArray(h.questions) ? (h.questions as unknown[]).length : 0,
      })),
      upcomingTopics,
      nudgeMessage,
      weeklyGoalSessions: weeklyGoal,
    };

    // ── Cache result ──────────────────────────────────────────────────────
    await cacheSet(cacheKey(userId), response, CACHE_TTL_S);

    logger.info('[DASHBOARD_API]', { userId, durationMs: Date.now() - start });
    const apiRes = NextResponse.json(response);
    apiRes.headers.set('Cache-Control', 'private, max-age=60');
    apiRes.headers.set('X-Cache', 'MISS');
    return apiRes;
  } catch (error) {
    logger.error('[DASHBOARD_API_ERROR]', { userId, error });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
