/**
 * Student Dashboard -- v2
 *
 * Full rebuild per v2 wireframe spec.
 *
 * Section order (single column mobile / two-column desktop):
 *   1. TodaysLearningCard -- topic name, subject badge, duration chip, CTA
 *      (Topbar with streak/level/avatar is in the shared layout)
 *   3. XPWidget           -- XP this week, level progress bar
 *   4. WeeklyStudyStrip   -- Mon-Sun dots, purple filled, teal today ring
 *   5. RevisionWidget     -- cards due today or "all caught up"
 *   --- desktop right column ---
 *   6. SubjectReadinessSection -- one card per subject
 *   7. WeakTopicsSection  -- hidden until 3+ sessions, max 2 cards
 *   8. UpcomingTopicsList -- next 3 topics, simple rows
 *
 * Desktop (md:): left 60% = sections 2-5, right 40% = sections 6-8.
 * Topbar is always full-width sticky.
 *
 * EDIT LOG:
 *   2026-03-15 | v2 migration | full rebuild; replaces v1 dashboard
 *   2026-03-15 | Task 28      | UpgradeFlow + UpgradeBanner replace PaymentButton gate
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { getWeakTopicsWithNames } from '@/lib/learning/getWeakTopics';
import { getMasteryLabel } from '@/lib/learning/masteryLabel';
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { computeReadinessScore } from '@/lib/student/examReadiness';

import TodaysLearningCard from '@/components/student/dashboard/TodaysLearningCard';
import WeeklyStudyStrip from '@/components/student/dashboard/WeeklyStudyStrip';
import XPWidget from '@/components/student/dashboard/XPWidget';
import RevisionWidget from '@/components/student/dashboard/RevisionWidget';
import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard';
import UpgradeFlow from '@/components/student/subscription/UpgradeFlow';
import UpgradeBanner from '@/components/student/subscription/UpgradeBanner';
import { checkFreeTierCap } from '@/lib/freemium';
import { getRedis } from '@/lib/redis';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Home | Spinzy AI Tutor',
  description: 'Your AI tutor -- ready when you are.',
};

// ── Week boundary helpers ─────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Handle all Prisma/Neon return shapes for String[] columns.
// Neon serverless driver sometimes returns Postgres wire-format "{a,b,c}".
function parseEnrolledSubjects(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).filter(Boolean).map(normaliseSubjectSlug)
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/^\{/, '').replace(/\}$/, '').split(',').map((s) => normaliseSubjectSlug(s.trim())).filter(Boolean)
  }
  return []
}

// Normalise legacy slug aliases stored in user profiles to canonical DB slugs.
const SLUG_ALIASES: Record<string, string> = {
  math:   'mathematics',
  maths:  'mathematics',
  sci:    'science',
  sst:    'social-science',
};
function normaliseSubjectSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StudentHomeDashboardPage() {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const { monday, sunday } = getISOWeekBoundaries();

  // ── Parallel data fetches ─────────────────────────────────────────────────
  const [
    studentProfile,
    activeSession,
    pendingHomeworkRaw,
    streakRow,
    weeklySessionsRaw,
    totalSessions,
    learningProfile,
    weakTopicsRaw,
    nextActionResult,
    orderedTopics,
    masteredTopicIds,
    freeTierStatus,
    userSub,
    xpThisWeekAgg,
    planTodayResult,
    upgradeDismissed,
  ] = await Promise.all([
    // 0. Student academic profile
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        board: true,
        grade: true,
        language: true,
        subjects: true,
        accountStatus: true,
        age: true,
        totalXp: true,
        level: true,
        name: true,
      },
    }),

    // 1. Active in-progress session
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

    // 2. Pending / overdue homework
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
      take: 1,
    }),

    // 3. Streak
    prisma.studentStreak.findFirst({
      where: { studentId: userId, kind: 'daily' },
      select: { current: true, best: true, lastActive: true },
    }),

    // 4. Sessions this week (for 7-day strip)
    prisma.structuredSession.findMany({
      where: { studentId: userId, startedAt: { gte: monday, lte: sunday } },
      select: { startedAt: true },
    }),

    // 5. Total session count (WeakTopicsSection gate)
    prisma.structuredSession.count({ where: { studentId: userId } }),

    // 6. Learning profile (weekly goal)
    prisma.studentLearningProfile
      .findFirst({ where: { studentId: userId }, select: { studyDaysPerWeek: true } })
      .catch(() => null),

    // 7. Weak topics (max 2)
    getWeakTopicsWithNames(userId).catch(() => []),

    // 8. Next topic recommendation (legacy engine fallback)
    getNextAction(userId).catch(() => null),

    // 9. Ordered curriculum topics for upcoming list
    getOrderedTopicsForStudent(userId).catch(() => []),

    // 10. Mastered topics (filter upcoming list)
    prisma.studentTopicProgress.findMany({
      where: { studentId: userId, mastery: { gte: 0.9 } },
      select: { topicId: true },
    }),

    // 11. Freemium cap check
    checkFreeTierCap(userId),

    // 12. Subscription status
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpiry: true, name: true, email: true },
    }),

    // 13. XP earned this week
    prisma.studentXP.aggregate({
      where: { studentId: userId, awardedAt: { gte: monday, lte: sunday } },
      _sum: { amount: true },
    }),

    // 14. Today's learning plan item
    (async () => {
      try {
        const plan = await prisma.learningPlan.findFirst({
          where: { studentId: userId },
          orderBy: { generatedAt: 'desc' },
          select: { id: true },
        });
        if (!plan) return null;

        const firstSession = await prisma.structuredSession.findFirst({
          where: { studentId: userId },
          orderBy: { startedAt: 'asc' },
          select: { startedAt: true },
        });
        const daysSinceFirst = firstSession
          ? Math.floor((Date.now() - firstSession.startedAt.getTime()) / 86_400_000)
          : 0;
        const currentWeek = Math.max(1, Math.ceil((daysSinceFirst + 1) / 7));

        const item = await prisma.learningPlanItem.findFirst({
          where: { planId: plan.id, status: 'UPCOMING', weekNumber: { lte: currentWeek } },
          orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
          select: {
            id: true,
            conceptId: true,
            weekNumber: true,
            orderInWeek: true,
            concept: {
              select: { name: true, subject: { select: { name: true } } },
            },
          },
        });
        return { item, planExists: true };
      } catch {
        return null;
      }
    })(),

    // 15. Upgrade gate dismiss check (Redis, non-blocking)
    (async () => {
      try {
        const redis = getRedis();
        if (!redis) return false;
        const val = await redis.get(`upgrade:dismissed:${userId}`);
        return val === '1';
      } catch {
        return false;
      }
    })(),
  ]);

  // ── Onboarding gates ──────────────────────────────────────────────────────
  const enrolledSubjects = parseEnrolledSubjects(studentProfile?.subjects)
  const needsProfile =
    !studentProfile?.board ||
    !studentProfile?.grade ||
    !studentProfile?.language ||
    enrolledSubjects.length === 0;

  // age guard: only under-DPDP_MINOR_AGE users require the phone OTP gate.
  // accountStatus alone is not sufficient -- stale 'pending_parent_verification' on
  // age >= DPDP_MINOR_AGE users (Task 1 dateOfBirth fix regression) must not fire.
  const profileAge = (studentProfile as any)?.age ?? null;
  const needsParentVerification =
    (studentProfile as any)?.accountStatus === 'pending_parent_verification' &&
    profileAge !== null &&
    Number.isFinite(Number(profileAge)) &&
    Number(profileAge) < DPDP_MINOR_AGE;

  if (needsProfile) {
    return (
      <main className="max-w-lg mx-auto px-4 py-6">
        <TodaysLearningCard type="empty" diagnosticHref="/student/onboarding" />
      </main>
    );
  }

  if (needsParentVerification) {
    return (
      <main className="max-w-lg mx-auto px-4 py-6">
        <section className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6 text-sm text-amber-900 dark:text-amber-200">
          <h1 className="mb-2 text-base font-semibold">Parent verification required</h1>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Since you&apos;re under 13, a parent mobile OTP verification is required to activate your account. Please complete it in the form that opened.
          </p>
        </section>
      </main>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const xpThisWeek = xpThisWeekAgg._sum.amount ?? 0;
  const totalXp = studentProfile?.totalXp ?? 0;
  const currentLevel = studentProfile?.level ?? 1;
  const studentName = studentProfile?.name ?? userSub?.name ?? 'Student';
  const streakCurrent = streakRow?.current ?? 0;
  const weeklyGoal = learningProfile?.studyDaysPerWeek ?? 5;

  // ── Weekly strip data ─────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return { date: d.toISOString().split('T')[0], dayLabel: DAY_LABELS[i], hasSession: false };
  });
  for (const s of weeklySessionsRaw) {
    const dow = new Date(s.startedAt).getUTCDay();
    const idx = dow === 0 ? 6 : dow - 1;
    if (idx >= 0 && idx < 7) weekDays[idx].hasSession = true;
  }

  // ── Learning plan → recommendation ────────────────────────────────────────
  type RawAction = { ruleId?: string; topicId?: string; topicName?: string | null; subject?: string | null; chapter?: string | null; estimatedTimeMin?: number } | null;
  const rawAction: RawAction =
    nextActionResult && typeof nextActionResult === 'object' && 'action' in nextActionResult
      ? (nextActionResult as { action: RawAction }).action
      : (nextActionResult as RawAction);

  const aheadOfPlan = planTodayResult?.planExists === true && planTodayResult.item == null;
  const planItem = planTodayResult?.item ?? null;

  const recommendation = planItem
    ? {
        conceptId: planItem.conceptId,
        topicTitle: planItem.concept?.name ?? planItem.conceptId,
        subject: planItem.concept?.subject?.name ?? '',
        estimatedTimeMin: 20,
        weekNumber: planItem.weekNumber,
      }
    : rawAction?.topicId
    ? {
        conceptId: rawAction.topicId,
        topicTitle: rawAction.topicName ?? rawAction.topicId,
        subject: rawAction.subject ?? '',
        estimatedTimeMin: rawAction.estimatedTimeMin ?? 20,
      }
    : null;

  // ── Primary card type ─────────────────────────────────────────────────────
  const engineRuleId = rawAction?.ruleId;
  const cardType =
    engineRuleId === 'homework_pending' || pendingHomeworkRaw.length > 0 ? 'homework'
    : activeSession ? 'resume'
    : recommendation ? 'start'
    : aheadOfPlan ? 'ahead'
    : 'empty';

  const oldestHw = pendingHomeworkRaw[0] ?? null;

  // ── Upcoming topics (next 3 unmastered, excluding current recommendation) ─
  const masteredIdSet = new Set(masteredTopicIds.map((r) => r.topicId));
  type OrderedTopic = { topicId?: string; id?: string; topicName?: string; name?: string; subject?: string };
  const upcomingTopics = (orderedTopics as OrderedTopic[])
    .filter((t) => {
      const id = t.topicId ?? t.id;
      return id && id !== recommendation?.conceptId && !masteredIdSet.has(id);
    })
    .slice(0, 3)
    .map((t) => ({
      topicId: t.topicId ?? t.id ?? '',
      topicTitle: t.topicName ?? t.name ?? '',
      subject: t.subject ?? '',
    }));

  // ── Subject readiness ─────────────────────────────────────────────────────
  // Only show readiness cards for the subjects the student enrolled in,
  // not all subjects available for their grade+board.
  // enrolledSubjects is already parsed above (wire-format safe).
  const subjectDefs =
    studentProfile?.grade && studentProfile?.board && enrolledSubjects.length > 0
      ? await prisma.subjectDef.findMany({
          where: {
            lifecycle: 'active',
            slug: { in: enrolledSubjects },
            class: {
              grade: parseInt(String(studentProfile.grade), 10),
              board: { slug: studentProfile.board },
            },
          },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      : [];

  const readinessResults = await Promise.all(
    subjectDefs.map(async (subj) => {
      const result = await computeReadinessScore(userId, subj.id).catch(() => null);
      return { subjectId: subj.id, subjectName: subj.name, score: result?.score ?? 0 };
    }),
  );

  // href for the "Take diagnostic test" CTA in the empty/onboarding card.
  // Uses the first enrolled subject resolved against DB so the link is always valid.
  const diagnosticHref = subjectDefs[0]?.id
    ? `/diagnostic/${subjectDefs[0].id}`
    : '/student/onboarding';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="px-4 py-5 max-w-5xl mx-auto">

        {/* Freemium upgrade gate / banner */}
        {userSub?.subscriptionStatus === 'free' && freeTierStatus.sessionsRemaining === 0 && (
          upgradeDismissed
            ? <UpgradeBanner show />
            : (
              <section id="upgrade-section" className="mb-5">
                <UpgradeFlow
                  studentName={userSub.name}
                  studentEmail={userSub.email}
                />
              </section>
            )
        )}

        {/* Two-column desktop grid */}
        <div className="flex flex-col gap-5 md:flex-row md:gap-6 md:items-start">

          {/* ── Left column (60%) -- sections 2-5 ── */}
          <div className="flex flex-col gap-5 md:w-3/5">

            {/* ② TodaysLearningCard */}
            <TodaysLearningCard
              type={cardType}
              diagnosticHref={diagnosticHref}
              recommendation={recommendation}
              session={
                activeSession
                  ? {
                      sessionId: activeSession.id,
                      topicId: activeSession.topicId,
                      topicName: activeSession.topic?.name ?? '',
                      subject: activeSession.topic?.chapter?.subject?.name ?? '',
                      chapter: activeSession.topic?.chapter?.name ?? '',
                      currentPhase: activeSession.state,
                    }
                  : null
              }
              homework={
                oldestHw
                  ? {
                      id: oldestHw.id,
                      topicName: oldestHw.topic?.name ?? '',
                      questionCount: Array.isArray(oldestHw.questions)
                        ? (oldestHw.questions as unknown[]).length
                        : 0,
                      dueDate: oldestHw.dueDate.toISOString(),
                      status: oldestHw.status as 'PENDING' | 'OVERDUE',
                    }
                  : null
              }
            />

            {/* ③ XPWidget */}
            <XPWidget totalXp={totalXp} level={currentLevel} xpThisWeek={xpThisWeek} />

            {/* ④ WeeklyStudyStrip */}
            <WeeklyStudyStrip
              data={{
                days: weekDays,
                sessionCountThisWeek: weeklySessionsRaw.length,
                currentStreak: streakCurrent,
                weeklyGoal,
              }}
            />

            {/* ⑤ RevisionWidget */}
            <RevisionWidget />
          </div>

          {/* ── Right column (40%) -- sections 6-8 ── */}
          <div className="flex flex-col gap-5 md:w-2/5">

            {/* ⑥ SubjectReadinessSection */}
            {readinessResults.length > 0 && (
              <section aria-labelledby="readiness-heading">
                <h3
                  id="readiness-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"
                >
                  Subject readiness
                </h3>
                <div className="space-y-3">
                  {readinessResults.map((r) => (
                    <a
                      key={r.subjectId}
                      href={`/student/progress/${r.subjectId}`}
                      className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
                    >
                      <SubjectReadinessCard
                        subjectName={r.subjectName}
                        score={r.score}
                        subjectId={r.subjectId}
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ⑦ WeakTopicsSection -- inline, hidden until 3+ sessions */}
            {totalSessions >= 3 && weakTopicsRaw.length > 0 && (
              <section aria-labelledby="weak-topics-heading">
                <h3
                  id="weak-topics-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"
                >
                  Needs more practice
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {weakTopicsRaw.slice(0, 2).map((t) => (
                    <article
                      key={t.topicId}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 mb-1">
                        {t.topicName}
                      </p>
                      <p className="text-xs font-medium text-[#E24B4A] dark:text-red-400 mb-3">
                        {getMasteryLabel(t.mastery)}
                      </p>
                      <a
                        href={`/session/${t.topicId}`}
                        className="flex w-full min-h-[44px] items-center justify-center rounded-lg border border-[#534AB7]/30 bg-[#534AB7]/5 dark:bg-[#534AB7]/10 text-xs font-semibold text-[#534AB7] dark:text-indigo-300 hover:bg-[#534AB7]/10 dark:hover:bg-[#534AB7]/20 transition-colors"
                      >
                        Revise
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* ⑧ UpcomingTopicsList -- inline simple rows */}
            {upcomingTopics.length > 0 && (
              <section aria-labelledby="upcoming-heading">
                <h3
                  id="upcoming-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"
                >
                  Up next
                </h3>
                <ul className="space-y-1" role="list">
                  {upcomingTopics.map((topic, i) => (
                    <li
                      key={topic.topicId}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 min-h-[44px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {topic.topicTitle}
                        </p>
                        {topic.subject && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{topic.subject}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <a
                  href="/learn/learning-path"
                  className="mt-3 inline-flex min-h-[44px] items-center text-xs font-medium text-[#534AB7] dark:text-indigo-400 hover:underline"
                >
                  View full learning path →
                </a>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
