/**
 * FILE OBJECTIVE:
 * - S2.2 lesson experience for topic learning with key points, rich content, hint card, and completion CTA.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/LessonExperience.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.2 lesson experience component
 * - 2026-04-25T01:45:00Z | copilot | added locale toggle, cached revalidation flow, dark mode styling, and inline hint placement
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DoubtPanel } from '@/components/session/DoubtPanel';

type LessonPayload = {
  topicId: string;
  locale: 'en' | 'hi';
  availableLocales: string[];
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  title: string;
  introduction: string;
  keyPoints: string[];
  sections: Array<{ heading: string; body: string; imageUrl: string | null; imageAlt: string | null }>;
  studyBuddyHint: string;
  hintPlacements: Array<{ sectionIndex: number; hintText: string }>;
  video: string | null;
};

type LessonExperienceProps = {
  studentId: string;
  topicId: string;
};

export default function LessonExperience({ studentId, topicId }: LessonExperienceProps) {
  const [lesson, setLesson] = useState<LessonPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [locale, setLocale] = useState<'en' | 'hi'>('en');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportIssueType, setReportIssueType] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showVidyaPanel, setShowVidyaPanel] = useState(false);

  function lessonCacheKey(topicIdValue: string, localeValue: 'en' | 'hi'): string {
    return `lesson-cache:${topicIdValue}:${localeValue}`;
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const cachedRaw = window.localStorage.getItem(lessonCacheKey(topicId, locale));
        if (cachedRaw) {
          const cachedPayload = JSON.parse(cachedRaw) as LessonPayload;
          if (active) {
            setLesson(cachedPayload);
            setIsLoading(false);
          }
        } else {
          setIsLoading(true);
        }
      } catch {
        setIsLoading(true);
      }
      setError(null);
      try {
        const res = await fetch(`/api/v1/content/${encodeURIComponent(topicId)}?locale=${locale}`);
        if (!res.ok) throw new Error(`Failed to load lesson (${res.status})`);
        const payload = (await res.json()) as LessonPayload;
        if (active) {
          setLesson(payload);
          window.localStorage.setItem(lessonCacheKey(topicId, locale), JSON.stringify(payload));
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [locale, topicId]);

  async function markComplete() {
    if (isCompleting || isCompleted) return;
    setIsCompleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/students/${encodeURIComponent(studentId)}/progress/topic/${encodeURIComponent(topicId)}/complete`,
        {
          method: 'POST',
        }
      );
      if (!res.ok) throw new Error('Failed to mark topic complete');
      setIsCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark complete');
    } finally {
      setIsCompleting(false);
    }
  }

  async function submitReport() {
    if (reportSubmitting || !reportIssueType || !reportDescription.trim()) return;
    setReportSubmitting(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/v1/content/${encodeURIComponent(topicId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType: reportIssueType, description: reportDescription.trim() }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setReportDone(true);
    } catch {
      setReportError("Couldn't submit right now. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  function closeReportModal() {
    setShowReportModal(false);
    setReportIssueType('');
    setReportDescription('');
    setReportDone(false);
    setReportError(null);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-4 h-44 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-xl border border-[#E24B4A] bg-[#FCEBEB] px-4 py-3 text-sm text-[#E24B4A]">
          {error ?? 'Lesson unavailable right now.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-[fadeIn_220ms_ease-out]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/student/learning-map" className="text-sm font-semibold text-[#534AB7] hover:underline dark:text-[#A69DFF]">
          ← Back to Map
        </Link>
        <div className="flex items-center gap-2">
          {lesson.availableLocales.includes('hi') && (
            <div className="flex rounded-lg border border-gray-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`min-h-[36px] rounded-md px-3 text-xs font-semibold ${
                  locale === 'en' ? 'bg-[#534AB7] text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLocale('hi')}
                className={`min-h-[36px] rounded-md px-3 text-xs font-semibold ${
                  locale === 'hi' ? 'bg-[#534AB7] text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                हिन्दी
              </button>
            </div>
          )}
          <button
            type="button"
            className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
            onClick={() => setShowReportModal(true)}
          >
            Report Content Issue
          </button>
        </div>
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {lesson.subjectName} · {lesson.chapterName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{lesson.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">{lesson.introduction}</p>

        {lesson.keyPoints.length > 0 && (
          <section className="mt-4 rounded-xl border border-[#534AB7]/20 bg-[#EEEDFE] p-4 dark:bg-[#534AB7]/15">
            <p className="text-sm font-semibold text-[#534AB7]">Key Points</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#3C3489]">
              {lesson.keyPoints.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5 space-y-4">
          {lesson.sections.map((section, index) => (
            <div key={`${section.heading}-${index}`} className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{section.heading}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">{section.body}</p>
              {section.imageUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
                  <Image
                    src={section.imageUrl}
                    alt={section.imageAlt ?? section.heading}
                    width={960}
                    height={540}
                    className="h-auto w-full"
                  />
                </div>
              )}
              {lesson.hintPlacements
                .filter((placement) => placement.sectionIndex === index)
                .map((placement) => (
                  <aside key={`${placement.sectionIndex}-${placement.hintText}`} className="mt-3 rounded-xl border border-[#1D9E75]/20 bg-[#EAF3DE] p-4 dark:bg-[#1D9E75]/10">
                    <p className="text-sm font-semibold text-[#1D9E75]">Study Buddy Hint</p>
                    <p className="mt-1 text-sm text-[#1D9E75]">{placement.hintText}</p>
                  </aside>
                ))}
            </div>
          ))}
        </section>

        {lesson.video && (
          <section className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowVideo((prev) => !prev)}
              className="min-h-[44px] text-sm font-semibold text-[#534AB7] hover:underline"
            >
              {showVideo ? 'Hide Video Snippet' : 'Show Video Snippet'}
            </button>
            {showVideo && (
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                <iframe
                  src={lesson.video}
                  title="Lesson Video"
                  className="h-64 w-full"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            )}
          </section>
        )}

        <aside className="mt-5 rounded-xl border border-[#1D9E75]/20 bg-[#EAF3DE] p-4 dark:bg-[#1D9E75]/10">
          <p className="text-sm font-semibold text-[#1D9E75]">Study Buddy Hint</p>
          <p className="mt-1 text-sm text-[#1D9E75]">{lesson.studyBuddyHint}</p>
        </aside>

        {error && (
          <p className="mt-4 rounded-lg border border-[#E24B4A] bg-[#FCEBEB] px-3 py-2 text-sm text-[#E24B4A]">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              void markComplete();
            }}
            disabled={isCompleting || isCompleted}
            className="min-h-[44px] rounded-xl bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {isCompleted ? 'Completed ✓' : isCompleting ? 'Marking...' : 'Mark as Complete'}
          </button>
          <Link
            href={`/student/learning-map/topic/${encodeURIComponent(topicId)}/practice`}
            className="min-h-[44px] rounded-xl border border-[#534AB7] px-4 py-2 text-center text-sm font-semibold text-[#534AB7] hover:bg-[#EEEDFE]"
          >
            Practice This Topic
          </Link>
        </div>
      </article>

      {/* Report Content Issue modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeReportModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Report a Content Issue</h2>
            {reportDone ? (
              <>
                <p className="mt-3 text-sm text-[#1D9E75]">Thanks for letting us know. We will review and fix it soon.</p>
                <button
                  type="button"
                  onClick={closeReportModal}
                  className="mt-4 min-h-[44px] w-full rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Help us improve this topic for everyone.</p>
                <div className="mt-4 space-y-2">
                  {[
                    { value: 'incorrect_info', label: 'Incorrect information' },
                    { value: 'typo', label: 'Typo or spelling error' },
                    { value: 'unclear_explanation', label: 'Unclear explanation' },
                    { value: 'missing_content', label: 'Missing content' },
                    { value: 'other', label: 'Other' },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 dark:border-slate-700">
                      <input
                        type="radio"
                        name="issueType"
                        value={value}
                        checked={reportIssueType === value}
                        onChange={() => setReportIssueType(value)}
                        className="accent-[#534AB7]"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  className="mt-3 min-h-[80px] w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300"
                  placeholder="Describe the issue (required)"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  maxLength={1000}
                />
                {reportError && (
                  <p className="mt-2 text-xs text-[#E24B4A]">{reportError}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={closeReportModal}
                    className="min-h-[44px] flex-1 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-600 dark:border-slate-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { void submitReport(); }}
                    disabled={reportSubmitting || !reportIssueType || !reportDescription.trim()}
                    className="min-h-[44px] flex-1 rounded-xl bg-[#534AB7] px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Teacher Vidya floating action button */}
      <button
        type="button"
        aria-label="Ask Teacher Vidya"
        onClick={() => setShowVidyaPanel(true)}
        className="fixed bottom-6 right-4 z-40 flex min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-[#534AB7] shadow-lg hover:bg-[#4238a3] sm:right-6"
      >
        <Image
          src="/logos/vidya/vidya-avatar-64.png"
          alt="Teacher Vidya"
          width={36}
          height={36}
          className="rounded-full object-cover"
        />
      </button>

      <DoubtPanel
        subject={lesson?.subjectName ?? ''}
        chapter={lesson?.chapterName ?? ''}
        topicName={lesson?.title ?? ''}
        isOpen={showVidyaPanel}
        onClose={() => setShowVidyaPanel(false)}
      />
    </div>
  );
}
