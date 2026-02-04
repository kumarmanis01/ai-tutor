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
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <Link href={`/learn/${courseId}`} style={{ fontSize: 14, color: '#0070f3' }}>← Back to course</Link>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 12 }}>{lesson.title}</h1>
        
        <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Login Required
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Please sign in to view lesson content and track your learning progress.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signin?mode=signup"
              className="px-6 py-3 border border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
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
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <div className="animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-32 w-full bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <Link href={`/learn/${courseId}`} style={{ fontSize: 14, color: '#0070f3' }}>← Back to course</Link>
      
      {/* Header with progress */}
      <div className="flex items-start justify-between mt-3">
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{lesson.title}</h1>
        {isCompleted && (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
            <span>✓</span> Completed
          </span>
        )}
      </div>
      
      {/* Progress indicator */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Lesson {Number(lessonIndex) + 1} of {totalLessons}
      </p>
      
      {Array.isArray(lesson.objectives) && lesson.objectives.length > 0 && (
        <div style={{ marginTop: 16, padding: 16, background: '#f0f7ff', borderRadius: 8 }} className="dark:bg-blue-900/20">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>📚 Learning Objectives</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {lesson.objectives.map((o, i) => <li key={i} style={{ color: '#444', marginBottom: 4 }} className="dark:text-gray-300">{o}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {lesson.explanation?.overview && (
          <p style={{ lineHeight: 1.7, fontSize: 15 }}>{lesson.explanation.overview}</p>
        )}
        {Array.isArray(lesson.explanation?.concepts) && lesson.explanation.concepts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {lesson.explanation.concepts.map((c, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} className="dark:bg-gray-800">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.title}</div>
                <div style={{ color: '#333', lineHeight: 1.6 }} className="dark:text-gray-300">{c.explanation}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mark Complete Button */}
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

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        {prev ? (
          <Link 
            href={`/learn/${courseId}/lesson/${prev.lessonIndex ?? 0}`} 
            style={{ padding: '10px 16px', background: '#f0f0f0', borderRadius: 8, textDecoration: 'none', color: '#333' }}
            className="dark:bg-gray-700 dark:text-gray-200"
          >
            ← Previous
          </Link>
        ) : <div />}
        {next ? (
          <Link 
            href={`/learn/${courseId}/lesson/${next.lessonIndex ?? 0}`} 
            style={{ padding: '10px 16px', background: '#0070f3', color: '#fff', borderRadius: 8, textDecoration: 'none' }}
          >
            Next →
          </Link>
        ) : (
          <Link 
            href={`/learn/${courseId}`} 
            style={{ padding: '10px 16px', background: '#10b981', color: '#fff', borderRadius: 8, textDecoration: 'none' }}
          >
            Back to Course ✓
          </Link>
        )}
      </div>
    </div>
  );
}
