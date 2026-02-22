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

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* 1. NextActionCard — map API shape { action } to component props */}
        <section aria-labelledby="next-action-heading">
          {nextAction?.action ? (
            <NextActionCard
              topic={nextAction.action.topicId ?? ''}
              subject={nextAction.action.subject ?? undefined}
              chapter={nextAction.action.chapter ?? undefined}
              actionType={nextAction.action.actionType}
              ruleId={nextAction.action.ruleId}
              reasonLabel={nextAction.action.reasonLabel}
              masteryLevel={nextAction.action.masteryLevel}
              estMinutes={nextAction.action.estimatedTimeMin}
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
