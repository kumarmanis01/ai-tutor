'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 5: HOMEWORK — Shows homework assignment card.
 * - Implements spec: "Homework should feel like reinforcement, not punishment."
 * - Two options: Start Homework now or Complete Later.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import type { HomeworkContent } from '@/lib/session/getPhaseContent';

interface HomeworkPhaseProps {
  content: HomeworkContent;
  onNext: () => void;
  loading?: boolean;
}

export function HomeworkPhase({ content, onNext, loading }: HomeworkPhaseProps) {
  const router = useRouter();

  const dueDate = new Date(content.dueDate);
  const dueDateLabel = dueDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const questions = Array.isArray(content.questions) ? content.questions : [];
  const questionCount = questions.length || 5; // sensible default when count unavailable
  const isAlreadyDone = content.status === 'SUBMITTED';

  const handleStartHomework = () => {
    router.push(`/tests?homework=${content.assignmentId}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <span className="text-5xl">📋</span>
        <h2 className="text-xl font-bold text-foreground mt-3">Homework assigned!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Completing homework reinforces what you just learned.
        </p>
      </div>

      {/* Homework card */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {questionCount} questions
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isAlreadyDone
                ? 'bg-green-500/10 text-green-600'
                : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            {isAlreadyDone ? 'Submitted' : 'Pending'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Due: {dueDateLabel}</span>
        </div>

        {content.score !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-semibold text-foreground">
              {Math.round((content.score ?? 0) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Tutor message */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🎓</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Completing homework within a few hours of learning locks in the memory.
          Even 5 minutes makes a big difference.
        </p>
      </div>

      {/* Actions */}
      {!isAlreadyDone ? (
        <div className="space-y-3">
          <button
            onClick={handleStartHomework}
            className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            Start Homework Now
          </button>
          <button
            onClick={onNext}
            disabled={loading}
            className="w-full py-3 px-6 bg-muted hover:bg-muted/80 text-muted-foreground font-medium rounded-xl transition-colors text-sm"
          >
            {loading ? <span className="animate-spin">⏳</span> : 'Complete Later'}
          </button>
        </div>
      ) : (
        <button
          onClick={onNext}
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? <span className="animate-spin">⏳</span> : (
            <>
              <span>Finish Session</span>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default HomeworkPhase;
