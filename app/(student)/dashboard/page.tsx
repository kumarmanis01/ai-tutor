import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';

import NextActionCard from '@/components/home/NextActionCard';
import TodayGoal from '@/components/home/TodayGoal';
import LearningPathSnapshot from '@/components/home/LearningPathSnapshot';
import TodaysPlan from '@/components/home/TodaysPlan';
import AssignmentsRow from '@/components/home/AssignmentsRow';
import UtilityRow from '@/components/home/UtilityRow';

export const metadata: Metadata = {
  title: 'AI Tutor - Student Dashboard | Your Learning Hub',
  description:
    'Access personalized learning content, practice tasks, and track progress with a curriculum-first Home.',
};

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export default async function StudentHomeDashboardPage() {
  const session = await requireActiveSession();
  if (!session) {
    redirect(`/`);
  }

  // Fetch required home data in parallel (server-side). Keep responses opaque
  // and do not compute rule engine logic in the UI.
  const [nextAction, todayGoal, learningSnapshot, dailyPlan] = (await Promise.all([
    fetchJson('/api/home/next-action'),
    fetchJson('/api/home/today-goal'),
    fetchJson('/api/home/learning-snapshot'),
    fetchJson('/api/home/daily-plan?date=today'),
  ])) as [any, any, any, any];

  // Derive hero title and CTA href from deterministic engine output
  const heroAction = nextAction?.action ?? null;

  function deriveTitle(ruleId: string | undefined, topicName: string | null | undefined): string {
    const name = topicName ?? '';
    switch (ruleId) {
      case 'resume_session':   return name ? `Resume: ${name}` : 'Resume where you left off';
      case 'daily_task':       return name ? `Today's Focus: ${name}` : "Today's Focus";
      case 'low_mastery':
      case 'low_accuracy':     return name ? `Strengthen: ${name}` : 'Strengthen your knowledge';
      case 'next_new_topic':   return name ? `Start: ${name}` : 'Start something new';
      default:                 return name || 'Continue Learning';
    }
  }

  function deriveCtaHref(
    actionType: string | undefined,
    topicId: string | null | undefined,
    sessionId: string | undefined,
  ): string | undefined {
    if (actionType === 'notes')     return `/learn/${encodeURIComponent(topicId ?? '')}`;
    if (actionType === 'practice') {
      if (sessionId) return `/practice/session/${encodeURIComponent(sessionId)}`;
      return `/practice/start?topicId=${encodeURIComponent(topicId ?? '')}`;
    }
    return undefined;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* 1. NextActionCard — map API shape { action } to component props */}
        <section aria-labelledby="next-action-heading">
          {heroAction ? (
            <NextActionCard
              topic={heroAction.topicId ?? ''}
              title={deriveTitle(heroAction.ruleId, heroAction.topicName)}
              ctaHref={deriveCtaHref(heroAction.actionType, heroAction.topicId, heroAction.sessionId)}
              subject={heroAction.subject ?? undefined}
              chapter={heroAction.chapter ?? undefined}
              actionType={heroAction.actionType}
              ruleId={heroAction.ruleId}
              reasonLabel={heroAction.reasonLabel}
              masteryLevel={heroAction.masteryLevel}
              estMinutes={heroAction.estimatedTimeMin}
            />
          ) : (
            <NextActionCard topic="" />
          )}
        </section>

        {/* 2. TodayGoal */}
        <section aria-labelledby="today-goal-heading">
          <TodayGoal
            targetMinutes={todayGoal?.targetMinutes ?? 0}
            completedMinutes={todayGoal?.completedMinutes ?? 0}
            streakDays={todayGoal?.streakDays ?? 0}
          />
        </section>

        {/* 3. LearningPathSnapshot */}
        <section aria-labelledby="learning-snapshot-heading">
          <LearningPathSnapshot subjects={learningSnapshot?.subjects ?? []} />
        </section>

        {/* 4. TodaysPlan */}
        <section aria-labelledby="todays-plan-heading">
          <TodaysPlan slots={dailyPlan?.slots ?? []} />
        </section>

        {/* 5. AssignmentsRow */}
        <section aria-labelledby="assignments-heading">
          <AssignmentsRow assignments={dailyPlan?.assignments ?? []} />
        </section>

        {/* 6. UtilityRow */}
        <section aria-labelledby="utility-heading">
          <UtilityRow unresolvedCount={0} />
        </section>
      </div>
    </main>
  );
}
