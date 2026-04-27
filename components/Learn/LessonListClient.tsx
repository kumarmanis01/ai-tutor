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
import SubjectLanguageControl from '@/components/student/SubjectLanguageControl';
function calculateProgress(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

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
  // Map overallProgress to a discrete width class (multiples of 5) to avoid inline styles
  const progressClassWidth = `w-pct-${Math.min(100, Math.max(0, Math.round(overallProgress / 5) * 5))}`;

  // Show login prompt if not authenticated
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="px-4 max-w-[600px] mx-auto">
        <Link href="/learn" className="text-sm text-[#0070f3] inline-flex items-center gap-1">
          ← Back to courses
        </Link>
        <h1 className="text-2xl font-semibold mt-3">{courseTitle}</h1>

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
      <div className="px-4 max-w-[600px] mx-auto">
        <div className="animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-full bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 max-w-[600px] mx-auto">
      <Link href="/learn" className="text-sm text-[#0070f3] inline-flex items-center gap-1">
        ← Back to courses
      </Link>
      <h1 className="text-2xl font-semibold mt-3">{courseTitle}</h1>
      {isSubject && (
        <div className="mt-3 mb-2">
          <SubjectLanguageControl subjectId={courseId} />
        </div>
      )}
      {courseDescription && <p className="text-gray-600 mt-2">{courseDescription}</p>}

      {/* Progress Bar */}
      {lessons.length > 0 && (
        <div className="mt-4 mb-6">
          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-300 ${overallProgress >= 100 ? 'bg-[#1D9E75]' : 'bg-[#534AB7]'} ${progressClassWidth}`}
              />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {completedCount} of {lessons.length} {isSubject ? 'chapters' : 'lessons'} completed
          </p>
        </div>
      )}

      <h2 className="text-lg font-semibold mt-6 mb-3">{isSubject ? '📚 Chapters' : '📖 Lessons'}</h2>
      
      {lessons.length === 0 ? (
        <div className="text-center p-5 bg-gray-50 rounded-md">
          <p className="text-gray-600">No content available yet.</p>
        </div>
      ) : (
        <ul className="list-none p-0">
          {lessons.map((l, i) => {
            const topicId = l.id || `${courseId}-${l.lessonIndex ?? i}`;
            const lessonProgress = progress.find((p: { topicId: string }) => p.topicId === topicId);
            const completionStatus = getCompletionStatus(
              lessonProgress?.isCompleted,
              lessonProgress?.isStarted,
              lessonProgress?.questionsAttempted
            );

            return (
              <li key={l.id ?? i} className="mb-2">
                <Link
                  href={`/learn/${courseId}/lesson/${l.lessonIndex ?? i}`}
                  className="block p-4 bg-white rounded-xl shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800 text-inherit"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {/* Progress Indicator */}
                      <TopicCompletionIndicator
                        status={completionStatus}
                        size="md"
                      />
                      <div>
                        <div className="font-semibold text-[15px]">{l.title}</div>
                        {Array.isArray(l.objectives) && l.objectives.length > 0 && (
                          <div className="text-[13px] text-gray-600 mt-1">
                            {l.objectives.slice(0, 2).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`text-[13px] flex items-center gap-1 ${completionStatus === 'completed' ? 'text-green-500' : 'text-[#0070f3]'}`}>
                      {completionStatus === 'completed' ? 'Review' : completionStatus === 'in-progress' ? 'Continue' : 'Start'} →
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  );
}
