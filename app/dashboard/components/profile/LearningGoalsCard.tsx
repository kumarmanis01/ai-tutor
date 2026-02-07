/**
 * FILE OBJECTIVE:
 * - Learning Goals card for student profile section.
 * - Allows students to set daily/weekly learning time goals.
 * - Child-friendly, encouraging design without stress-inducing metrics.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/profile/LearningGoalsCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created LearningGoalsCard per PRD specifications
 */
'use client';

import React, { useState, useCallback } from 'react';
import useStreaksAndGoals from '@/hooks/useStreaksAndGoals';

/** Preset goal options for easy selection */
const DAILY_GOAL_OPTIONS = [
  { minutes: 15, label: '15 min', description: 'Quick review' },
  { minutes: 30, label: '30 min', description: 'Balanced learning' },
  { minutes: 45, label: '45 min', description: 'Deep focus' },
  { minutes: 60, label: '1 hour', description: 'Extended session' },
];

const WEEKLY_GOAL_OPTIONS = [
  { days: 3, label: '3 days', description: 'Easy start' },
  { days: 5, label: '5 days', description: 'Weekday learning' },
  { days: 7, label: 'Every day', description: 'Full commitment' },
];

interface LearningGoalsCardProps {
  /** Callback when goals are updated */
  onGoalsUpdated?: (dailyMinutes: number, weeklyDays: number) => void;
}

/**
 * LearningGoalsCard - Set and track learning goals
 *
 * Design Principles (from PRD):
 * - Encouragement over evaluation: Goals are personal, not competitive
 * - Child-friendly: Simple choices, no complex forms
 * - Positive framing: "You're doing great!" not "You missed your goal"
 */
export function LearningGoalsCard({ onGoalsUpdated }: LearningGoalsCardProps) {
  const { data: streaksData, loading } = useStreaksAndGoals();
  
  const [dailyGoal, setDailyGoal] = useState<number>(
    streaksData?.dailyGoalMinutes ?? 30
  );
  const [weeklyGoal, setWeeklyGoal] = useState<number>(
    streaksData?.weeklyGoalDays ?? 5
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // API call to save goals would go here
      await fetch('/api/user/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyGoalMinutes: dailyGoal,
          weeklyGoalDays: weeklyGoal,
        }),
      });
      onGoalsUpdated?.(dailyGoal, weeklyGoal);
      setIsEditing(false);
    } catch {
      // Silently handle error - child-safe, no scary messages
    } finally {
      setIsSaving(false);
    }
  }, [dailyGoal, weeklyGoal, onGoalsUpdated]);

  if (loading) {
    return (
      <div className="bg-card dark:bg-slate-800/50 rounded-xl p-6 border border-border/30 animate-pulse">
        <div className="h-6 bg-muted rounded w-40 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isEditing) {
    // Display current goals
    return (
      <div className="bg-card dark:bg-slate-800/50 rounded-xl p-6 border border-border/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            🎯 My Learning Goals
          </h3>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>

        <div className="space-y-4">
          {/* Daily Goal Display */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <p className="font-medium text-foreground">Daily Goal</p>
                <p className="text-sm text-muted-foreground">
                  {dailyGoal} minutes per day
                </p>
              </div>
            </div>
            {streaksData?.todayMinutes !== undefined && (
              <div className="text-right">
                <p className="font-bold text-primary">
                  {streaksData.todayMinutes}/{dailyGoal}
                </p>
                <p className="text-xs text-muted-foreground">min today</p>
              </div>
            )}
          </div>

          {/* Weekly Goal Display */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-medium text-foreground">Weekly Goal</p>
                <p className="text-sm text-muted-foreground">
                  {weeklyGoal} days per week
                </p>
              </div>
            </div>
            {streaksData?.weekDaysActive !== undefined && (
              <div className="text-right">
                <p className="font-bold text-primary">
                  {streaksData.weekDaysActive}/{weeklyGoal}
                </p>
                <p className="text-xs text-muted-foreground">days this week</p>
              </div>
            )}
          </div>
        </div>

        {/* Encouraging message */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          🌟 Small steps lead to big achievements!
        </p>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="bg-card dark:bg-slate-800/50 rounded-xl p-6 border border-border/30">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        🎯 Set Your Goals
      </h3>

      <div className="space-y-6">
        {/* Daily Goal Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            How long do you want to study each day?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DAILY_GOAL_OPTIONS.map((option) => (
              <button
                key={option.minutes}
                type="button"
                onClick={() => setDailyGoal(option.minutes)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  dailyGoal === option.minutes
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Goal Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            How many days per week?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {WEEKLY_GOAL_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setWeeklyGoal(option.days)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  weeklyGoal === option.days
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="flex-1 py-2 px-4 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </div>

      {/* Encouraging note */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        You can change your goals anytime. What matters is that you keep learning! 💪
      </p>
    </div>
  );
}

export default LearningGoalsCard;
