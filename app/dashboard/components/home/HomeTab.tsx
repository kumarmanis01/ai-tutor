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
import { ContinueWhereLeftOff } from './ContinueWhereLeftOff';
import { WeeklyProgressSnapshot } from './WeeklyProgressSnapshot';

interface HomeTabProps {
  /** Callback when user clicks on a learning item to start/resume */
  onStartLearning?: (topicId: string) => void;
  /** Callback when user clicks on continue activity */
  onContinueActivity?: (activityId: string, type: string) => void;
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
export function HomeTab({ onStartLearning, onContinueActivity }: HomeTabProps) {
  return (
    <div className="space-y-6 pb-24 px-4 sm:px-6">
      {/* Greeting Section */}
      <StudentGreeting />

      {/* Welcome Banner - Shows once for new students after onboarding */}
      <WelcomeBanner />

      {/* Recovery Banner - Shows when student returns after inactivity */}
      <RecoveryBanner />

      {/* Primary CTA - Today's Learning */}
      <section aria-labelledby="todays-learning-heading">
        <TodaysLearningCard onStartLearning={onStartLearning} />
      </section>

      {/* Secondary - Resume Last Activity */}
      <section aria-labelledby="continue-learning-heading">
        <ContinueWhereLeftOff onContinueActivity={onContinueActivity} />
      </section>

      {/* Progress Overview - No ranks/scores */}
      <section aria-labelledby="weekly-progress-heading">
        <WeeklyProgressSnapshot />
      </section>

      {/* Encouraging Footer Message */}
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          🌟 Every step you take makes you smarter!
        </p>
      </div>
    </div>
  );
}

export default HomeTab;
