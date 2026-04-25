/**
 * FILE OBJECTIVE:
 * - Container component for the Home tab of student dashboard.
 * - Composes StudentGreeting, TodaysLearningCard, ContinueWhereLeftOff, and WeeklyProgressSnapshot.
 * - Follows "Zero Cognitive Overload" principle from PRD.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/HomeTab.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created HomeTab container for student dashboard PRD refactor
 */
'use client';

import React from 'react';
import { StudentGreeting } from './StudentGreeting';
import { WelcomeBanner } from './WelcomeBanner';
import { RecoveryBanner } from './RecoveryBanner';
import { TodaysLearningCard } from './TodaysLearningCard';
import { WeeklyProgressSnapshot } from './WeeklyProgressSnapshot';
import { SubjectMasteryBars } from '@/components/dashboard/home/SubjectMasteryBars';
import { StreakCalendar } from '@/components/dashboard/home/StreakCalendar';
import { RecentlyStudied } from '@/components/dashboard/home/RecentlyStudied';
import { ReviewQueueCard } from '@/components/dashboard/home/ReviewQueueCard';
import { WeakTopicsCard } from '@/components/dashboard/home/WeakTopicsCard';
import { UpcomingTopics } from '@/components/dashboard/home/UpcomingTopics';

interface HomeTabProps {
  /** Callback when user clicks on a learning item to start/resume */
  onStartLearning?: (topicId: string) => void;
}

/**
 * HomeTab - Main landing view for student dashboard
 *
 * Design Principles (from PRD):
 * - Zero cognitive overload: Shows only what's needed for today
 * - One primary CTA: "Today's Learning" is the main action
 * - Encouragement over evaluation: No scores, ranks, or comparisons
 * - Child-safe design: Age-appropriate language and visuals
 */
export function HomeTab({ onStartLearning }: HomeTabProps) {
  return (
    <div className="space-y-6 pb-24 px-4 sm:px-6">
      {/* Greeting + streak badge */}
      <StudentGreeting />

      {/* Welcome Banner - Shows once for new students after onboarding */}
      <WelcomeBanner />

      {/* Recovery Banner - Shows when student returns after inactivity */}
      <RecoveryBanner />

      {/* Primary CTA - Today's Learning */}
      <section aria-labelledby="todays-learning-heading">
        <TodaysLearningCard onStartLearning={onStartLearning} />
      </section>

      {/* Visual streak calendar (Gap #10) */}
      <section aria-label="Weekly activity calendar">
        <StreakCalendar />
      </section>

      {/* Recent activities -- up to 5 items (Gap #8) */}
      <section aria-label="Recently studied">
        <RecentlyStudied />
      </section>

      {/* Spaced revision queue (Gap #6) */}
      <section aria-label="Review queue">
        <ReviewQueueCard />
      </section>

      {/* Weak topics nudge (Gap #7) */}
      <section aria-label="Weak topics">
        <WeakTopicsCard />
      </section>

      {/* Per-subject mastery bars (Gap #5) */}
      <section aria-label="Subject progress">
        <SubjectMasteryBars />
      </section>

      {/* Progress stats */}
      <section aria-labelledby="weekly-progress-heading">
        <WeeklyProgressSnapshot />
      </section>

      {/* Upcoming curriculum topics (Gap #9) */}
      <section aria-label="Upcoming topics">
        <UpcomingTopics />
      </section>

      {/* Encouraging footer */}
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">🌟 Every step you take makes you smarter!</p>
      </div>
    </div>
  );
}

export default HomeTab;
