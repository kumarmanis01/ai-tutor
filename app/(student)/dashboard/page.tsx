/**
 * Student Home Dashboard — Phase 1 UX Redesign
 *
 * Replaces the previous 14-section dashboard with a 5-section tutor-driven
 * layout. A single consolidated fetch from /api/dashboard replaces 8 parallel
 * fetches, reducing latency and simplifying the component tree.
 *
 * Section order (matches UX architecture blueprint):
 *   1. PrimaryActionCard   — single hero CTA (resume / start / homework)
 *   2. NudgeBanner         — optional in-app nudge, dismissable
 *   3. WeeklyStudyStrip    — 7-day Mon–Sun activity dots + streak text
 *   4. HomeworkPendingCard — pending homework (hidden when empty)
 *   5. WeakTopicsSection   — up to 2 weak topics (hidden until 3+ sessions)
 *   6. UpcomingTopicsList  — next 3 topics in curriculum + learning path link
 *
 * Rollback: git revert this file. No backend or DB changes required.
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | full redesign per UX architecture blueprint.
 *               Previous 14-section layout preserved in git history.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { getWeakTopicsWithNames } from '@/lib/learning/getWeakTopics';
import { getMasteryLabel } from '@/lib/learning/masteryLabel';
import { getNudgeMessage } from '@/lib/dashboard/nudgeMessage';
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';

import PrimaryActionCard from '@/components/home/PrimaryActionCard';
import WeeklyStudyStrip from '@/components/home/WeeklyStudyStrip';
import HomeworkPendingCard from '@/components/home/HomeworkPendingCard';
import WeakTopicsSection from '@/components/home/WeakTopicsSection';
import UpcomingTopicsList from '@/components/home/UpcomingTopicsList';
import NudgeBanner from '@/components/home/NudgeBanner';
import { EngagementSection } from '@/components/home/EngagementSection';
import RevisionWidget from '@/components/student/dashboard/RevisionWidget';
import XPWidget from '@/components/student/dashboard/XPWidget';
import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard';
import PaymentButton from '@/components/student/PaymentButton';
import { checkFreeTierCap } from '@/lib/freemium';
import { computeExamReadiness } from '@/lib/student/examReadiness';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Home | Spinzy AI Tutor',
  description: 'Your AI tutor — ready when you are.',
};

// ── Week boundary helpers ─────────────────────────────────────────────────────

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
    lastSessionRow,
    masteredTopicIds,
    freeTierStatus,
    userSub,
    xpThisWeekAgg,
  ] = await Promise.all([
    // 0. Student academic profile for onboarding gate + XP fields
    prisma.user.findUnique({
      where: { id: userId },
      select: { board: true, grade: true, language: true, subjects: true, accountStatus: true, totalXp: true, level: true },
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
      take: 3,
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

    // 5. Total session count (for WeakTopicsSection gate)
    prisma.structuredSession.count({ where: { studentId: userId } }),

    // 6. Learning profile (weekly goal)
    prisma.studentLearningProfile
      .findFirst({ where: { studentId: userId }, select: { studyDaysPerWeek: true } })
      .catch(() => null),

    // 7. Weak topics (max 2 on dashboard)
    getWeakTopicsWithNames(userId).catch(() => []),

    // 8. Next topic recommendation
    getNextAction(userId).catch(() => null),

    // 9. Ordered curriculum topics for upcoming list
    getOrderedTopicsForStudent(userId).catch(() => []),

    // 10. Last session for nudge calculation
    prisma.structuredSession.findFirst({
      where: { studentId: userId },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
    }),

    // 11. Mastered topics (for filtering upcoming list)
    prisma.studentTopicProgress.findMany({
      where: { studentId: userId, mastery: { gte: 0.9 } },
      select: { topicId: true },
    }),
    checkFreeTierCap(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpiry: true, name: true, email: true },
    }),

    // 14. XP earned this week
    prisma.studentXP.aggregate({
      where: { studentId: userId, awardedAt: { gte: monday, lte: sunday } },
      _sum: { amount: true },
    }),
  ]);

  // ── Onboarding Gate: block learning features when profile is incomplete ──
  const needsProfile =
    !studentProfile?.board ||
    !studentProfile?.grade ||
    !studentProfile?.language ||
    !Array.isArray(studentProfile.subjects) ||
    studentProfile.subjects.length === 0;

  const needsParentVerification = (studentProfile as any)?.accountStatus === 'pending_parent_verification';

  if (needsProfile) {
    // The OnboardingProvider + OnboardingModal handle actually showing the
    // modal client-side. Here we simply avoid rendering learning features
    // on the dashboard until the academic profile is completed.
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-700">
          <h1 className="mb-2 text-lg font-semibold text-gray-900">
            Welcome to Spinzy!
          </h1>
          <p className="mb-1">
            Let&apos;s set up your learning profile before you start studying.
          </p>
          <p className="mb-3">
            Please choose your Board, Class, Language, and Subjects in the
            onboarding form that just opened.
          </p>
          <p className="text-xs text-gray-500">
            Once your profile is complete, your home tutor and diagnostic
            assessment will be unlocked automatically.
          </p>
        </section>
      </main>
    );
  }

  if (needsParentVerification) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          <h1 className="mb-2 text-lg font-semibold">Parent verification required</h1>
          <p className="mb-3">
            Since you&apos;re under 13, a parent mobile OTP verification is required to activate your account.
          </p>
          <p className="text-xs text-amber-800">
            Please complete the verification step in the onboarding form that just opened.
          </p>
        </section>
      </main>
    );
  }

  // ── XP this week ─────────────────────────────────────────────────────────
  const xpThisWeek = xpThisWeekAgg._sum.amount ?? 0
  const totalXp = studentProfile?.totalXp ?? 0
  const currentLevel = studentProfile?.level ?? 1

  // ── Subject readiness scores ─────────────────────────────────────────────
  const subjectNames = (studentProfile?.subjects ?? []).map((s) => String(s)).filter(Boolean)
  const subjectDefsForReadiness = subjectNames.length
    ? await prisma.subjectDef.findMany({
        where: {
          OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }],
          lifecycle: 'active',
        },
        select: { id: true, name: true },
      })
    : []
  const readinessResults = await Promise.all(
    subjectDefsForReadiness.map(async (subj) => {
      const result = await computeExamReadiness(userId, subj.id).catch(() => null)
      return {
        subjectId: subj.id,
        subjectName: subj.name,
        score: result ? Math.round(result.score) : 0,
      }
    }),
  )

  // ── Build weekly activity strip ─────────────────────────────────────────
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

  // ── Unwrap next action ──────────────────────────────────────────────────
  type RawAction = { ruleId?: string; topicId?: string; topicName?: string | null; subject?: string | null; chapter?: string | null; estimatedTimeMin?: number } | null;
  const rawAction: RawAction = nextActionResult && typeof nextActionResult === 'object' && 'action' in nextActionResult
    ? (nextActionResult as { action: RawAction }).action
    : (nextActionResult as RawAction);
  const recommendation = rawAction?.topicId ? rawAction : null;

  // ── Primary action type — driven by engine ruleId ───────────────────────
  // The engine is the single source of truth for what the student should do.
  // P0 (homework_pending) → 'homework'; P1 (resume_session) → 'resume'; else → 'start'.
  const oldestPendingHomework = pendingHomeworkRaw[0] ?? null;
  const engineRuleId = rawAction?.ruleId;
  const primaryType =
    engineRuleId === 'homework_pending' ? 'homework'
    : engineRuleId === 'resume_session' ? 'resume'
    : 'start';

  // ── Upcoming topics + "builds on" context ──────────────────────────────
  const masteredIdSet = new Set(masteredTopicIds.map((r) => r.topicId));
  const recTopicId = recommendation?.topicId;
  type OrderedTopic = { topicId?: string; id?: string; topicName?: string; name?: string; subject?: string };

  // "Builds on" = the most recent mastered topic in curriculum order before the
  // recommended topic. Used to give the student continuity context in StartState.
  const buildsOnTopicName = (() => {
    if (!recTopicId) return undefined;
    const ordered = orderedTopics as OrderedTopic[];
    const recIndex = ordered.findIndex((t) => (t.topicId ?? t.id) === recTopicId);
    if (recIndex <= 0) return undefined;
    // Walk backwards from the recommended topic to find the last mastered one
    for (let i = recIndex - 1; i >= 0; i--) {
      const id = ordered[i].topicId ?? ordered[i].id;
      if (id && masteredIdSet.has(id)) {
        return ordered[i].topicName ?? ordered[i].name ?? undefined;
      }
    }
    return undefined;
  })();

  const upcomingTopics = (orderedTopics as OrderedTopic[])
    .filter((t) => {
      const id = t.topicId ?? t.id;
      return id && id !== recTopicId && !masteredIdSet.has(id);
    })
    .slice(0, 3)
    .map((t) => ({
      topicId: t.topicId ?? t.id ?? '',
      topicTitle: t.topicName ?? t.name ?? '',
      subject: t.subject ?? '',
    }));

  // ── Nudge message ───────────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* 0. Daily Learning Habit — today's goal (primary CTA), streak, weekly calendar */}
      <EngagementSection nextTopicId={recommendation?.topicId ?? null} />

      {/* Revisions due today — highest priority */}
      <RevisionWidget />

      {/* Freemium upgrade gate */}
      {userSub?.subscriptionStatus === 'free' && freeTierStatus.sessionsRemaining === 0 && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-900">
          <h2 className="mb-1 text-base font-semibold">You&apos;ve used your free sessions</h2>
          <p className="mb-3 text-xs text-indigo-900/80">
            Upgrade to continue learning with unlimited AI tutor sessions this month.
          </p>
          <PaymentButton
            planMonths={1}
            studentName={userSub.name}
            studentEmail={userSub.email}
            onSuccess={() => {
              // After payment, reload dashboard to pick up new subscriptionStatus.
              // The client router will handle the refresh.
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            onFailure={() => {
              // No-op: inline error is shown in the button component.
            }}
          />
        </section>
      )}

      {/* 1. Primary Action — single hero CTA, always visible */}
      <PrimaryActionCard
        type={primaryType}
        session={
          activeSession
            ? {
                sessionId: activeSession.id,
                topicName: activeSession.topic?.name ?? '',
                currentPhase: activeSession.state,
                resumePhase: activeSession.state,
                subject: activeSession.topic?.chapter?.subject?.name ?? '',
                chapter: activeSession.topic?.chapter?.name ?? '',
              }
            : null
        }
        recommendation={
          recommendation
            ? {
                topicId: recommendation.topicId!,
                topicTitle: recommendation.topicName ?? recommendation.topicId!,
                subject: recommendation.subject ?? '',
                chapter: recommendation.chapter ?? undefined,
                estimatedTimeMin: recommendation.estimatedTimeMin ?? 20,
                buildsOnTopicName,
              }
            : null
        }
        pendingHomework={
          oldestPendingHomework
            ? {
                id: oldestPendingHomework.id,
                topicName: oldestPendingHomework.topic?.name ?? '',
                questionCount: Array.isArray(oldestPendingHomework.questions)
                  ? (oldestPendingHomework.questions as unknown[]).length
                  : 0,
                dueDate: oldestPendingHomework.dueDate.toISOString(),
                status: oldestPendingHomework.status as 'PENDING' | 'OVERDUE',
              }
            : null
        }
      />

      {/* 2. Nudge Banner — dismissable, calm tone, optional */}
      <NudgeBanner nudgeMessage={nudgeMessage} />

      {/* 3. Weekly Study Strip — 7-day Mon–Sun activity dots */}
      <WeeklyStudyStrip
        data={{
          days: weekDays,
          sessionCountThisWeek: weeklySessionsRaw.length,
          currentStreak: streakRow?.current ?? 0,
        }}
      />

      {/* 3b. XP Widget + Subject Readiness */}
      <XPWidget totalXp={totalXp} level={currentLevel} xpThisWeek={xpThisWeek} />
      {readinessResults.length > 0 && (
        <div className="space-y-3">
          {readinessResults.map((r) => (
            <SubjectReadinessCard
              key={r.subjectId}
              subjectName={r.subjectName}
              score={r.score}
              subjectId={r.subjectId}
            />
          ))}
        </div>
      )}

      {/* 4. Homework Pending — hidden when empty */}
      <HomeworkPendingCard
        items={pendingHomeworkRaw.map((h) => ({
          id: h.id,
          topicName: h.topic?.name ?? '',
          status: h.status as 'PENDING' | 'OVERDUE',
          dueDate: h.dueDate.toISOString(),
          questionCount: Array.isArray(h.questions)
            ? (h.questions as unknown[]).length
            : 0,
        }))}
      />

      {/* 5. Weak Topics — hidden until 3+ sessions, max 2 cards */}
      <WeakTopicsSection
        topics={weakTopicsRaw.slice(0, 2).map((t) => ({
          topicId: t.topicId,
          topicName: t.topicName,
          masteryLabel: getMasteryLabel(t.mastery),
        }))}
        sessionCount={totalSessions}
      />

      {/* 6. Upcoming Topics — simple list + learning path link */}
      <UpcomingTopicsList topics={upcomingTopics} />

    </main>
  );
}
