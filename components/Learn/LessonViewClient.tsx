/**
 * FILE OBJECTIVE:
 * - Client component for viewing lesson content with progress tracking.
 *   Records view on mount and provides "Mark Complete" functionality.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Learn/LessonViewClient.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | replaced inline styles with Tailwind (Gap #17)
 * - 2026-02-04 | claude | created for MVP progress integration
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTopicProgress } from '@/hooks/useTopicProgress';

export interface LessonConcept {
  title: string;
  explanation: string;
}

export interface LessonData {
  id?: string;
  lessonIndex?: number;
  title: string;
  slug?: string;
  objectives?: string[];
  explanation?: {
    overview?: string;
    concepts?: LessonConcept[];
  };
}

export interface LessonNav {
  lessonIndex?: number;
  id?: string;
}

export interface LessonViewClientProps {
  courseId: string;
  lessonIndex: string;
  lesson: LessonData;
  prev: LessonNav | null;
  next: LessonNav | null;
  totalLessons: number;
}

/**
 * LessonViewClient - Displays lesson content with progress tracking.
 * Records view on mount and allows marking lesson as complete.
 */
export default function LessonViewClient({
  courseId,
  lessonIndex,
  lesson,
  prev,
  next,
  totalLessons,
}: LessonViewClientProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const isLoading = status === 'loading';

  const topicId = lesson.id || `${courseId}-${lessonIndex}`;

  const { recordView, markComplete, getTopicProgress } = useTopicProgress({
    topicId,
    autoFetch: isAuthenticated,
  });

  const [isMarking, setIsMarking] = useState(false);
  const [hasRecordedView, setHasRecordedView] = useState(false);

  const lessonProgress = getTopicProgress(topicId);
  const isCompleted = lessonProgress?.isCompleted ?? false;

  // Record view on mount (once per session)
  useEffect(() => {
    if (isAuthenticated && !hasRecordedView) {
      recordView(topicId, courseId, lesson.title);
      setHasRecordedView(true);
    }
  }, [isAuthenticated, hasRecordedView, topicId, courseId, lesson.title, recordView]);

  const handleMarkComplete = async () => {
    if (isMarking || isCompleted) return;
    setIsMarking(true);
    await markComplete(topicId, courseId, lesson.title);
    setIsMarking(false);
  };

  // Show login prompt if not authenticated
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Link href={`/learn/${courseId}`} className="text-sm text-primary hover:underline">
          ← Back to course
        </Link>
        <h1 className="text-2xl font-semibold mt-3 text-foreground">{lesson.title}</h1>

        <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Login Required</h2>
          <p className="text-muted-foreground mb-4">
            Please sign in to view lesson content and track your learning progress.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-[#534AB7] hover:bg-[#3C3489] text-white font-semibold rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signin?mode=signup"
              className="px-6 py-3 border border-indigo-300 dark:border-[#534AB7] text-[#534AB7] dark:text-indigo-400 font-semibold rounded-lg hover:bg-[#EEEDFE] dark:hover:bg-indigo-900/30 transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 max-w-2xl mx-auto animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-4" />
        <div className="h-8 w-64 bg-muted rounded mb-4" />
        <div className="h-32 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Link href={`/learn/${courseId}`} className="text-sm text-primary hover:underline">
        ← Back to course
      </Link>

      {/* Header with completion badge */}
      <div className="flex items-start justify-between mt-3">
        <h1 className="text-2xl font-semibold text-foreground">{lesson.title}</h1>
        {isCompleted && (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
            <span>✓</span> Completed
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground mt-1">
        Lesson {Number(lessonIndex) + 1} of {totalLessons}
      </p>

      {/* Learning objectives */}
      {Array.isArray(lesson.objectives) && lesson.objectives.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="font-semibold mb-2">📚 Learning Objectives</p>
          <ul className="list-disc pl-5 space-y-1">
            {lesson.objectives.map((o, i) => (
              <li key={i} className="text-sm text-foreground/80 dark:text-foreground/70">{o}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Content */}
      <div className="mt-5 space-y-4">
        {lesson.explanation?.overview && (
          <p className="leading-[1.7] text-[15px] text-foreground/90">{lesson.explanation.overview}</p>
        )}
        {Array.isArray(lesson.explanation?.concepts) && lesson.explanation.concepts.length > 0 && (
          <div className="space-y-4">
            {lesson.explanation.concepts.map((c, i) => (
              <div key={i} className="p-4 bg-card rounded-lg shadow-sm border">
                <p className="font-semibold mb-2 text-foreground">{c.title}</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{c.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mark Complete */}
      {!isCompleted && (
        <div className="mt-6">
          <button
            onClick={handleMarkComplete}
            disabled={isMarking}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isMarking ? (
              <>
                <span className="animate-spin">⏳</span>
                Marking...
              </>
            ) : (
              <>
                <span>✓</span>
                Mark as Complete
              </>
            )}
          </button>
        </div>
      )}

      {/* Lesson Navigation */}
      <div className="flex justify-between mt-6">
        {prev ? (
          <Link
            href={`/learn/${courseId}/lesson/${prev.lessonIndex ?? 0}`}
            className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            ← Previous
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/learn/${courseId}/lesson/${next.lessonIndex ?? 0}`}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Next →
          </Link>
        ) : (
          <Link
            href={`/learn/${courseId}`}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Back to Course ✓
          </Link>
        )}
      </div>
    </div>
  );
}
