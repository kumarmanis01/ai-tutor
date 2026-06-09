/**
 * FILE OBJECTIVE:
 * - Client widget that fetches and renders the student's 3-topic daily study plan
 *   on the home screen using SWR. Handles skeleton, empty, and populated states.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

'use client';

import React from 'react';
import useSWR from 'swr';
import { Card } from '@/components/UI/design-system/Card';
import { Pill } from '@/components/UI/design-system/Pill';
import { SubjectGlyph } from '@/components/UI/design-system/SubjectChip';
import type { SubjectId } from '@/components/UI/design-system/SubjectChip';
import type { StudyPlanTopic } from '@/lib/studyPlan/dailyPlan';

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const PLAN_API_PATH = '/api/study-plan/today';

async function fetchPlan(url: string): Promise<{ plan: StudyPlanTopic[]; cached: boolean }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ plan: StudyPlanTopic[]; cached: boolean }>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="flex items-center gap-3 min-h-[56px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
        />
      ))}
    </div>
  );
}

function PlanRow({ topic }: { topic: StudyPlanTopic }) {
  const subjectId = topic.subject.toLowerCase() as SubjectId;
  const label = topic.topicSlug.replace(/-/g, ' ');

  return (
    <a
      href={`/ask?topic=${encodeURIComponent(topic.topicSlug)}&subject=${encodeURIComponent(topic.subject)}&difficulty=${topic.suggestedDifficulty}`}
      className="flex items-center gap-3 min-h-[56px] rounded-xl px-3 py-2 transition-colors hover:bg-primary-bg dark:hover:bg-gray-800"
    >
      <SubjectGlyph subjectId={subjectId} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate capitalize">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{topic.subject}</p>
      </div>
      <Pill intent={topic.state === 'DEVELOPING' ? 'amber' : 'primary'}>
        {topic.state === 'DEVELOPING' ? 'Continue' : 'New'}
      </Pill>
    </a>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export default function TodaysPlanWidget() {
  const { data, error, isLoading } = useSWR(PLAN_API_PATH, fetchPlan, {
    revalidateOnFocus: false,
  });

  return (
    <Card padding="compact">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Today&apos;s plan
      </h2>

      {isLoading && <PlanSkeleton />}

      {!isLoading && error && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
          Couldn&apos;t load your plan -- tap to retry.
        </p>
      )}

      {!isLoading && !error && data?.plan.length === 0 && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No topics yet. Take a test so Vidya can build your plan.
          </p>
          <a
            href="/tests"
            className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Find a test
          </a>
        </div>
      )}

      {!isLoading && !error && data && data.plan.length > 0 && (
        <div className="flex flex-col gap-1">
          {data.plan.map((topic) => (
            <PlanRow key={`${topic.topicSlug}:${topic.subject}`} topic={topic} />
          ))}
        </div>
      )}
    </Card>
  );
}
