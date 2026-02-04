/**
 * FILE OBJECTIVE:
 * - Client component for displaying lesson list with progress indicators.
 *   Requires authentication. Shows completion status per lesson.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Learn/LessonListClient.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP progress integration
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTopicProgress } from '@/hooks/useTopicProgress';
import TopicCompletionIndicator, { getCompletionStatus } from '@/components/TopicCompletionIndicator';
import ProgressBar, { calculateProgress } from '@/components/ProgressBar';

export interface Lesson {
  id: string;
  lessonIndex?: number;
  title: string;
  slug?: string;
  objectives?: string[];
}

export interface LessonListClientProps {
  courseId: string;
  courseTitle: string;
  courseDescription?: string;
  lessons: Lesson[];
  isSubject?: boolean;
}

/**
 * LessonListClient - Displays lessons with progress indicators.
 * Requires user to be logged in.
 */
export default function LessonListClient({
  courseId,
  courseTitle,
  courseDescription,
  lessons,
  isSubject = false,
}: LessonListClientProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const isLoading = status === 'loading';

  // Fetch progress for this course's lessons
  const { progress } = useTopicProgress({
    subject: courseId,
    autoFetch: isAuthenticated,
  });

  // Calculate overall progress
  const completedCount = lessons.filter((l) => {
    const p = progress.find((pr: { topicId: string; isCompleted?: boolean }) => pr.topicId === l.id || pr.topicId === `${courseId}-${l.lessonIndex}`);
    return p?.isCompleted;
  }).length;
  const overallProgress = calculateProgress(completedCount, lessons.length);

  // Show login prompt if not authenticated
  if (!isLoading && !isAuthenticated) {
    return (
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <Link href="/learn" style={{ fontSize: 14, color: '#0070f3', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ← Back to courses
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 12 }}>{courseTitle}</h1>
        
        <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Login Required
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Please sign in to access course content, track your progress, and take practice tests.
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
          <div className="h-4 w-full bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <Link href="/learn" style={{ fontSize: 14, color: '#0070f3', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ← Back to courses
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 12 }}>{courseTitle}</h1>
      {courseDescription && <p style={{ color: '#666', marginTop: 8 }}>{courseDescription}</p>}

      {/* Progress Bar */}
      {lessons.length > 0 && (
        <div className="mt-4 mb-6">
          <ProgressBar 
            progress={overallProgress} 
            variant={overallProgress >= 100 ? 'success' : 'default'}
            size="md"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {completedCount} of {lessons.length} {isSubject ? 'chapters' : 'lessons'} completed
          </p>
        </div>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
        {isSubject ? '📚 Chapters' : '📖 Lessons'}
      </h2>
      
      {lessons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: 8 }}>
          <p style={{ color: '#666' }}>No content available yet.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {lessons.map((l, i) => {
            const topicId = l.id || `${courseId}-${l.lessonIndex ?? i}`;
            const lessonProgress = progress.find((p: { topicId: string }) => p.topicId === topicId);
            const completionStatus = getCompletionStatus(
              lessonProgress?.isCompleted,
              lessonProgress?.isStarted,
              lessonProgress?.questionsAttempted
            );

            return (
              <li key={l.id ?? i} style={{ marginBottom: 8 }}>
                <Link 
                  href={`/learn/${courseId}/lesson/${l.lessonIndex ?? i}`} 
                  style={{ 
                    textDecoration: 'none', 
                    color: 'inherit',
                    display: 'block',
                    padding: 16,
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'box-shadow 0.2s'
                  }}
                  className="hover:shadow-md dark:bg-gray-800"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="flex items-center gap-3">
                      {/* Progress Indicator */}
                      <TopicCompletionIndicator 
                        status={completionStatus}
                        size="md"
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{l.title}</div>
                        {Array.isArray(l.objectives) && l.objectives.length > 0 && (
                          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                            {l.objectives.slice(0, 2).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: 13, 
                      color: completionStatus === 'completed' ? '#10b981' : '#0070f3',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {completionStatus === 'completed' ? 'Review' : completionStatus === 'in-progress' ? 'Continue' : 'Start'} →
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
