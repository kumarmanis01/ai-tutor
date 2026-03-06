'use client';

/**
 * FILE OBJECTIVE:
 * - Simplified Practice page with 4 sections:
 *   1. Recommended Practice — from TopicRanker
 *   2. Weak Topics Practice — topics where mastery < 0.4
 *   3. Chapter Practice — select subject → chapter → topics
 *   4. Custom Test — advanced filters (collapsible)
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created simplified topic-first Practice layout
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';
import type { HierarchySubject, HierarchyChapter, HierarchyTopic } from '@/hooks/useAcademicHierarchy';
import AdvancedPracticeFilters from '@/components/practice/AdvancedPracticeFilters';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  practiceCount: number;
}

interface PracticeOverview {
  recommendedTopic: RecommendedTopic | null;
  weakTopics: WeakTopicEntry[];
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PracticeTab() {
  const { data: profile } = useCurrentUser();
  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();

  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/practice/overview')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setOverview({
          recommendedTopic: data?.recommendedTopic ?? null,
          weakTopics: data?.weakTopics ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setOverview({ recommendedTopic: null, weakTopics: [] });
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const practiceHref = useCallback((topicId: string, difficulty?: string) => {
    const params = new URLSearchParams({ topicId });
    if (difficulty) params.set('difficulty', difficulty);
    return `/practice/start?${params.toString()}`;
  }, []);

  const subjects = helpers.getSubjectsForGrade(profile?.board, profile?.grade);

  return (
    <div className="space-y-8 px-3 sm:px-4 py-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold">Practice</h1>
        <p className="text-sm text-gray-500">Choose a topic to practice</p>
      </div>

      {/* Section 1: Recommended Practice */}
      <section>
        <SectionHeading title="Recommended Practice" accent="indigo" />
        {overviewLoading ? (
          <SectionSkeleton />
        ) : overview?.recommendedTopic ? (
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">
              {overview.recommendedTopic.reason}
            </p>
            <h3 className="text-lg font-bold text-gray-900">
              {overview.recommendedTopic.topicTitle}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {overview.recommendedTopic.subject} &middot; {overview.recommendedTopic.chapter}
            </p>
            <Link
              href={practiceHref(overview.recommendedTopic.topicId)}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlayIcon />
              Start Practice
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
            No recommendation right now. Browse by chapter or use custom filters below.
          </div>
        )}
      </section>

      {/* Section 2: Weak Topics Practice */}
      <section>
        <SectionHeading title="Weak Topics Practice" accent="amber" />
        {overviewLoading ? null : overview && overview.weakTopics.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.weakTopics.map((t) => (
              <Link
                key={t.topicId}
                href={practiceHref(t.topicId)}
                className="text-left rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 truncate">
                    {t.topicName}
                  </h3>
                  <MasteryBadge mastery={t.mastery} />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {t.subject} &middot; {t.chapter}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No weak topics. Keep up the good work!</p>
        )}
      </section>

      {/* Section 3: Chapter Practice */}
      <section>
        <SectionHeading title="Chapter Practice" accent="gray" />
        {hierarchyLoading ? (
          <SectionSkeleton />
        ) : subjects.length === 0 ? (
          <p className="text-sm text-gray-400">No subjects found for your profile.</p>
        ) : (
          <div className="space-y-2">
            {subjects.map((sub) => (
              <ChapterPracticeAccordion
                key={sub.id}
                subject={sub}
                helpers={helpers}
                practiceHref={practiceHref}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Custom Test */}
      <section>
        <SectionHeading title="Custom Test" accent="gray" />
        <AdvancedPracticeFilters />
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeading({ title, accent }: { title: string; accent: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-400',
  };
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className={`inline-block w-2 h-2 rounded-full ${colors[accent] ?? 'bg-gray-400'}`}
        aria-hidden
      />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
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

function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="h-24 bg-gray-100 rounded-xl" />
    </div>
  );
}

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

// ─── Subject → Chapter → Topics accordion ─────────────────────────────────────

function ChapterPracticeAccordion({
  subject,
  helpers,
  practiceHref,
}: {
  subject: HierarchySubject;
  helpers: ReturnType<typeof useAcademicHierarchy>['helpers'];
  practiceHref: (topicId: string) => string;
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
              <ChapterTopicsBlock
                key={ch.id}
                chapter={ch}
                helpers={helpers}
                practiceHref={practiceHref}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ChapterTopicsBlock({
  chapter,
  helpers,
  practiceHref,
}: {
  chapter: HierarchyChapter;
  helpers: ReturnType<typeof useAcademicHierarchy>['helpers'];
  practiceHref: (topicId: string) => string;
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
            topics.map((t) => (
              <Link
                key={t.id}
                href={practiceHref(t.id)}
                className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {t.name}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
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
