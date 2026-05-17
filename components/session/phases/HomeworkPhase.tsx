'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 5: HOMEWORK -- Assignment card with Start Now / Complete Later.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import type { HomeworkContent } from '@/lib/session/getPhaseContent';

interface HomeworkPhaseProps {
  content: HomeworkContent;
  onReadyToProceed?: (ready: boolean) => void;
  loading?: boolean;
}

export function HomeworkPhase({
  content,
  onReadyToProceed,
  loading: _loading,
}: HomeworkPhaseProps) {
  const router = useRouter();
  React.useEffect(() => {
    // Only mark the phase as ready to proceed when homework is submitted.
    // This prevents showing the primary "Finish Session" CTA while homework is still pending.
    onReadyToProceed?.(isAlreadyDone);
  }, [onReadyToProceed]);
  const isAlreadyDone = content.status === 'SUBMITTED';
  const questions = Array.isArray(content.questions) ? content.questions : [];
  const questionCount = questions.length || 5;

  const dueDateLabel = new Date(content.dueDate).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <span className="text-5xl">📋</span>
        <h2 className="text-xl font-bold text-foreground mt-3">Homework assigned!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Completing homework within a few hours locks in the memory.
        </p>
      </div>

      <div className="bg-card rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{questionCount} questions</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isAlreadyDone ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            {isAlreadyDone ? 'Submitted' : 'Pending'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg
            className="w-4 h-4 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Due: {dueDateLabel}
        </div>
        {content.score !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-semibold">{Math.round((content.score ?? 0) * 100)}%</span>
          </div>
        )}
      </div>

      <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🎓</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Completing homework within a few hours of learning locks in the memory. Even 5 minutes
          makes a big difference.
        </p>
      </div>

      {!isAlreadyDone && (
        <button
          onClick={() => router.push(`/homework/${content.assignmentId}`)}
          className="w-full py-4 px-6 bg-[#534AB7] hover:bg-[#3C3489] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Start Homework Now
        </button>
      )}
      {isAlreadyDone && (
        <button
          onClick={() => router.push(`/homework/${content.assignmentId}`)}
          className="w-full py-4 px-6 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border border-border"
        >
          Review Answers
        </button>
      )}
      {/* Primary CTA (Finish Session) is in SessionFooter */}
    </div>
  );
}

export default HomeworkPhase;