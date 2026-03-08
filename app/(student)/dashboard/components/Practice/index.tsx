'use client';

/**
 * FILE OBJECTIVE:
 * - Simplified Practice page with section-tab navigation (no filters).
 * - Four sections, one visible at a time:
 *     1. Recommended Practice (default) — from TopicRanker
 *     2. Weak Topics Practice            — mastery < 0.4
 *     3. Chapter Practice                — subject → chapter → topic drill-down
 *     4. Custom Test                     — difficulty picker + hierarchy browser
 * - Students can start practice in ≤ 2 clicks from any section.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | replaced filter-heavy stacked layout with
 *                              section-tab UI; removed CascadingFilters dependency
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';
import type {
  HierarchySubject,
  HierarchyChapter,
  HierarchyTopic,
} from '@/hooks/useAcademicHierarchy';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecommendedTopic {
  topicId: string;
  topicTitle: string;
  subject: string;
  chapter: string;
  reason: string;
}

interface WeakTopicEntry {
  topicId: string;
  topicName: string;
  chapter: string;
  subject: string;
  mastery: number;
}

type SectionId = 'recommended' | 'weak' | 'chapter' | 'custom';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'weak',        label: 'Weak Topics' },
  { id: 'chapter',     label: 'Chapter' },
  { id: 'custom',      label: 'Custom Test' },
];

const DIFFICULTIES = [
  { value: '',       label: 'Any' },
  { value: 'easy',   label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PracticeTab() {
  const { data: profile } = useCurrentUser();
  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<SectionId>('recommended');
  const [recommended, setRecommended] = useState<RecommendedTopic | null>(null);
  const [weakTopics, setWeakTopics] = useState<WeakTopicEntry[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Custom Test state
  const [customDifficulty, setCustomDifficulty] = useState('');
  const [customTopicId, setCustomTopicId] = useState<string | null>(null);
  const [customTopicName, setCustomTopicName] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/practice/overview')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRecommended(data?.recommendedTopic ?? null);
        setWeakTopics(data?.weakTopics ?? []);
      })
      .catch(() => {
        if (!cancelled) { setRecommended(null); setWeakTopics([]); }
      })
      .finally(() => { if (!cancelled) setOverviewLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const practiceHref = useCallback((topicId: string, difficulty?: string) => {
    const p = new URLSearchParams({ topicId });
    if (difficulty) p.set('difficulty', difficulty);
    return `/practice/start?${p.toString()}`;
  }, []);

  const subjects = helpers.getSubjectsForGrade(profile?.board, profile?.grade);

  const handleSelectCustomTopic = useCallback((topicId: string, topicName: string) => {
    setCustomTopicId(topicId);
    setCustomTopicName(topicName);
  }, []);

  function startCustomTest() {
    if (!customTopicId) return;
    router.push(practiceHref(customTopicId, customDifficulty || undefined));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-3 sm:px-4 py-4">
      {/* Page header */}
      <div className="mb-5 space-y-0.5">
        <h1 className="text-xl sm:text-2xl font-bold">Practice</h1>
        <p className="text-sm text-gray-500">Start practice in 2 clicks</p>
      </div>

      {/* Section tab pills */}
      <div
        role="tablist"
        aria-label="Practice sections"
        className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide"
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={activeSection === s.id}
            onClick={() => setActiveSection(s.id)}
            className={[
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              activeSection === s.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Section panels ─────────────────────────────────────────────────── */}

      {/* 1. Recommended Practice */}
      {activeSection === 'recommended' && (
        <section aria-label="Recommended Practice">
          {overviewLoading ? (
            <RecommendedSkeleton />
          ) : recommended ? (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm">
              <span className="inline-block rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-600 mb-3">
                {recommended.reason}
              </span>
              <h2 className="text-xl font-bold text-gray-900 leading-snug">
                {recommended.topicTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {recommended.subject} &middot; {recommended.chapter}
              </p>
              <Link
                href={practiceHref(recommended.topicId)}
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <PlayIcon />
                Start Practice
              </Link>
            </div>
          ) : (
            <EmptyState
              message="No recommendation yet."
              hint="Try Weak Topics or browse by Chapter."
            />
          )}
        </section>
      )}

      {/* 2. Weak Topics Practice */}
      {activeSection === 'weak' && (
        <section aria-label="Weak Topics Practice">
          {overviewLoading ? (
            <CardGridSkeleton />
          ) : weakTopics.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {weakTopics.map((t) => (
                <Link
                  key={t.topicId}
                  href={practiceHref(t.topicId)}
                  className="block rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-gray-900 leading-snug">
                      {t.topicName}
                    </h3>
                    <MasteryBadge mastery={t.mastery} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t.subject} &middot; {t.chapter}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              message="No weak topics found."
              hint="Great job! Try Recommended Practice to keep improving."
            />
          )}
        </section>
      )}

      {/* 3. Chapter Practice */}
      {activeSection === 'chapter' && (
        <section aria-label="Chapter Practice">
          {hierarchyLoading ? (
            <CardGridSkeleton />
          ) : subjects.length === 0 ? (
            <EmptyState message="No subjects found for your profile." />
          ) : (
            <div className="space-y-2">
              {subjects.map((sub) => (
                <SubjectAccordion
                  key={sub.id}
                  subject={sub}
                  helpers={helpers}
                  onSelectTopic={(id) => router.push(practiceHref(id))}
                  actionLabel="Practice"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. Custom Test */}
      {activeSection === 'custom' && (
        <section aria-label="Custom Test">
          {/* Difficulty selector */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Difficulty
            </p>
            <div className="flex gap-2 flex-wrap">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setCustomDifficulty(d.value)}
                  className={[
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                    customDifficulty === d.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ].join(' ')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic selection */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Select Topic
            </p>
            {hierarchyLoading ? (
              <CardGridSkeleton />
            ) : (
              <div className="space-y-2">
                {subjects.map((sub) => (
                  <SubjectAccordion
                    key={sub.id}
                    subject={sub}
                    helpers={helpers}
                    onSelectTopic={handleSelectCustomTopic}
                    actionLabel="Select"
                    selectedTopicId={customTopicId ?? undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* CTA bar — shown once a topic is selected */}
          {customTopicId ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700 truncate">
                <span className="font-semibold">{customTopicName}</span>
                {customDifficulty && (
                  <span className="ml-2 text-gray-500 capitalize">· {customDifficulty}</span>
                )}
              </p>
              <button
                type="button"
                onClick={startCustomTest}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlayIcon />
                Start Test
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Select a topic above to start your test.</p>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SubjectAccordion({
  subject,
  helpers,
  onSelectTopic,
  actionLabel,
  selectedTopicId,
}: {
  subject: HierarchySubject;
  helpers: ReturnType<typeof useAcademicHierarchy>['helpers'];
  onSelectTopic: (topicId: string, topicName: string) => void;
  actionLabel: string;
  selectedTopicId?: string;
}) {
  const [open, setOpen] = useState(false);
  const chapters = helpers.getChaptersForSubject(subject.id);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-800">{subject.name}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {chapters.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">No chapters found</p>
          ) : (
            chapters.map((ch) => (
              <ChapterBlock
                key={ch.id}
                chapter={ch}
                helpers={helpers}
                onSelectTopic={onSelectTopic}
                actionLabel={actionLabel}
                selectedTopicId={selectedTopicId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ChapterBlock({
  chapter,
  helpers,
  onSelectTopic,
  actionLabel: _actionLabel,
  selectedTopicId,
}: {
  chapter: HierarchyChapter;
  helpers: ReturnType<typeof useAcademicHierarchy>['helpers'];
  onSelectTopic: (topicId: string, topicName: string) => void;
  actionLabel: string;
  selectedTopicId?: string;
}) {
  const [open, setOpen] = useState(false);
  const topics: HierarchyTopic[] = helpers.getTopicsForChapter(chapter.id);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm text-gray-700">
          <span className="text-gray-400 mr-1.5">{chapter.order}.</span>
          {chapter.name}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="pl-10 pr-4 pb-2 space-y-1">
          {topics.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No topics found</p>
          ) : (
            topics.map((t) => {
              const isSelected = selectedTopicId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTopic(t.id, t.name)}
                  className={[
                    'w-full text-left flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                    isSelected
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700',
                  ].join(' ')}
                >
                  <span>{t.name}</span>
                  {isSelected && <CheckIcon />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MasteryBadge({ mastery }: { mastery: number }) {
  const pct = Math.round(mastery * 100);
  return (
    <span className="shrink-0 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      {pct}%
    </span>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-8 text-center">
      <p className="text-sm font-medium text-gray-600">{message}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RecommendedSkeleton() {
  return (
    <div className="rounded-2xl border border-indigo-100 p-6 animate-pulse space-y-3">
      <div className="h-4 w-32 bg-indigo-100 rounded-full" />
      <div className="h-6 w-56 bg-gray-200 rounded" />
      <div className="h-4 w-40 bg-gray-100 rounded" />
      <div className="h-9 w-36 bg-indigo-200 rounded-xl mt-2" />
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
