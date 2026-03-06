import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';

import NextActionCard from '@/components/home/NextActionCard';
import ResumeSessionCard from '@/components/home/ResumeSessionCard';
import TutorRecommendationCard from '@/components/home/TutorRecommendationCard';
import TodayGoal from '@/components/home/TodayGoal';
import LearningPathSnapshot from '@/components/home/LearningPathSnapshot';
import TodaysPlan from '@/components/home/TodaysPlan';
import AssignmentsRow from '@/components/home/AssignmentsRow';
import UtilityRow from '@/components/home/UtilityRow';
import PerformanceSnapshot from '@/components/home/PerformanceSnapshot';
import StudyStreakCard from '@/components/home/StudyStreakCard';
import WeakTopicsCard from '@/components/home/WeakTopicsCard';

export const dynamic = 'force-dynamic';

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
  } catch {
    return null;
  }
}

export default async function StudentHomeDashboardPage() {
  const session = await requireActiveSession();
  if (!session) {
    redirect(`/`);
  }

  // Fetch all home data in parallel — server-side, no stale cache.
  const [nextAction, todayGoal, learningSnapshot, dailyPlan, perfSnapshot, streakData, weakTopicsData] = (await Promise.all([
    fetchJson('/api/home/next-action'),
    fetchJson('/api/home/today-goal'),
    fetchJson('/api/home/learning-snapshot'),
    fetchJson('/api/home/daily-plan'),
    fetchJson('/api/home/performance-snapshot'),
    fetchJson('/api/student/streak'),
    fetchJson('/api/student/weak-topics'),
  ])) as [any, any, any, any, any, any, any];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* 0. Resume active session — self-fetching, hides when no session */}
        <section aria-labelledby="resume-session-heading">
          <ResumeSessionCard />
        </section>

        {/* 1. NextActionCard */}
        <section aria-labelledby="next-action-heading">
          {nextAction ? <NextActionCard {...nextAction} /> : <NextActionCard topic="" />}
        </section>

        {/* 1b. Tutor Recommendation — runs in parallel, self-fetching */}
        <section aria-labelledby="tutor-recommendation-heading">
          <TutorRecommendationCard />
        </section>

        {/* 2. TodayGoal */}
        <section aria-labelledby="today-goal-heading">
          <TodayGoal
            targetMinutes={todayGoal?.targetMinutes ?? DEFAULT_GOAL_MIN}
            completedMinutes={todayGoal?.completedMinutes ?? 0}
            streakDays={todayGoal?.streakDays ?? 0}
          />
        </section>

        {/* 2b. Study Streak */}
        <section aria-labelledby="study-streak-heading">
          <StudyStreakCard
            currentStreak={streakData?.currentStreak ?? 0}
            longestStreak={streakData?.longestStreak ?? 0}
          />
        </section>

        {/* 3. LearningPathSnapshot — real curriculum + mastery data */}
        <section aria-labelledby="learning-snapshot-heading">
          <LearningPathSnapshot subjects={learningSnapshot?.subjects ?? []} />
        </section>

        {/* 4. Weak Topics */}
        <section aria-labelledby="weak-topics-heading">
          <WeakTopicsCard topics={weakTopicsData?.topics ?? []} />
        </section>

        {/* 4b. Performance Snapshot — last 5 practice results */}
        <section aria-labelledby="perf-snapshot-heading">
          <PerformanceSnapshot
            recentResults={perfSnapshot?.recentResults ?? []}
            averageAccuracy={perfSnapshot?.averageAccuracy ?? 0}
            weakestTopic={perfSnapshot?.weakestTopic ?? null}
          />
        </section>

        {/* 5. TodaysPlan */}
        <section aria-labelledby="todays-plan-heading">
          <TodaysPlan slots={dailyPlan?.slots ?? []} />
        </section>

        {/* 6. AssignmentsRow */}
        <section aria-labelledby="assignments-heading">
          <AssignmentsRow assignments={dailyPlan?.assignments ?? []} />
        </section>

        {/* 7. UtilityRow */}
        <section aria-labelledby="utility-heading">
          <UtilityRow unresolvedCount={0} />
        </section>
      </div>
    </main>
  );
}

const DEFAULT_GOAL_MIN = 30;
