/**
 * FILE OBJECTIVE:
 * - Chapter info panel for selected/current chapter in S2.1 learning map.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/ChapterInfo.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.1 chapter info panel
 */

'use client';

import React from 'react';
import type { LearningMapNode } from '@/hooks/useLearningMap';

type ChapterInfoProps = {
  chapter: LearningMapNode | null;
};

export function ChapterInfo({ chapter }: ChapterInfoProps) {
  if (!chapter) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">No chapter selected yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Chapter</p>
      <h2 className="mt-1 text-lg font-bold text-gray-900">{chapter.chapterName}</h2>
      <p className="mt-2 text-sm text-gray-600">
        {chapter.completedTopics} of {chapter.topicsCount} topics complete
      </p>
      <p className="mt-1 text-sm text-gray-600">Completion: {chapter.completionPercent}%</p>
      <p className="mt-1 text-sm text-gray-600">Estimated score: {chapter.scorePercent}%</p>
    </section>
  );
}

export default ChapterInfo;
