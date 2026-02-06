/**
 * FILE OBJECTIVE:
 * - Primary CTA card showing today's daily task from the Daily Habit Engine.
 * - Shows task type badge, title, description, sub-steps, and estimated time.
 * - Completed state shows motivation message.
 * - Falls back to recommendation engine if no daily task generated.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/TodaysLearningCard.spec.tsx
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | refactored to use DHE daily task API instead of recommendations
 * - 2026-02-04 | claude | created for student dashboard PRD refactor
 */
'use client';

import React from 'react';
import { useDailyTask } from '@/hooks/useDailyTask';
import { useRouter } from 'next/navigation';

export interface TodaysLearningCardProps {
  onStartLearning?: (topicId: string) => void;
}

const TASK_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  learn: { label: 'Learn', color: 'bg-indigo-500/15 text-indigo-600', icon: '📖' },
  practice: { label: 'Practice', color: 'bg-green-500/15 text-green-600', icon: '🎯' },
  revise: { label: 'Revise', color: 'bg-amber-500/15 text-amber-600', icon: '🔄' },
  fix_gap: { label: 'Build Up', color: 'bg-orange-500/15 text-orange-600', icon: '💪' },
  confidence: { label: 'Show Off', color: 'bg-pink-500/15 text-pink-600', icon: '⭐' },
};

export function TodaysLearningCard({ onStartLearning }: TodaysLearningCardProps) {
  const router = useRouter();
  const { task, loading, _completeTask, skipTask } = useDailyTask();

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/4 mb-3" />
        <div className="h-6 bg-muted rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted rounded w-1/3 mb-6" />
        <div className="h-12 bg-muted rounded-xl w-full" />
      </div>
    );
  }

  // Completed state
  if (task?.status === 'completed') {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl p-6 border border-green-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🎉</span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Done for today!</h3>
            <p className="text-sm text-muted-foreground">
              {task.motivationMessage || 'Great work! See you tomorrow.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard?tab=notes')}
          className="w-full py-3 px-4 bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 font-medium rounded-xl transition-colors text-sm"
        >
          Want to explore more?
        </button>
      </div>
    );
  }

  // Skipped / expired state
  if (task?.status === 'skipped' || task?.status === 'expired') {
    return (
      <div className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <span className="text-2xl">👋</span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">No worries!</h3>
            <p className="text-sm text-muted-foreground">You can always explore on your own.</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard?tab=notes')}
          className="w-full py-3 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded-xl transition-colors text-sm"
        >
          Browse subjects
        </button>
      </div>
    );
  }

  // No task available
  if (!task) {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl p-6 border border-green-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🌟</span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">You&apos;re all set!</h3>
            <p className="text-sm text-muted-foreground">Nothing scheduled for today</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard?tab=notes')}
          className="w-full py-3 px-4 bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 font-medium rounded-xl transition-colors text-sm"
        >
          Want to explore something?
        </button>
      </div>
    );
  }

  // Active task (pending)
  const config = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.learn;
  const steps = Array.isArray(task.steps) ? task.steps : [];

  const handleStart = () => {
    if (onStartLearning && task.topicId) {
      onStartLearning(task.topicId);
    }
    if (task.topicId) {
      router.push(`/learn/${task.topicId}`);
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
      {/* Task Type Badge + Subject */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${config.color}`}>
          {config.icon} {config.label}
        </span>
        {task.subject && (
          <span className="text-xs text-muted-foreground">
            {task.subject}
          </span>
        )}
        {task.isRecoveryTask && (
          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-600 text-xs rounded-full">
            Welcome Back
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold text-foreground mb-1">
        {task.title}
      </h2>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-muted-foreground mb-4">
          {task.description}
        </p>
      )}

      {/* Steps Preview */}
      {steps.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 flex items-center justify-center text-xs text-muted-foreground">
                {i + 1}
              </div>
              <span className="text-foreground/80">{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Estimated Time */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>{task.estimatedTimeMin} mins</span>
        {task.chapter && (
          <>
            <span>•</span>
            <span>{task.chapter}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleStart}
          className="flex-1 py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <span>Start</span>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={skipTask}
          className="py-4 px-4 bg-muted/50 hover:bg-muted text-muted-foreground font-medium rounded-xl transition-colors text-sm"
          title="Skip for today"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export default TodaysLearningCard;
