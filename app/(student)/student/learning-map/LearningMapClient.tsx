/**
 * FILE OBJECTIVE:
 * - Client wrapper for S2.1 learning map page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-map/LearningMapClient.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created learning map page client
 */

'use client';

import React from 'react';
import { useLearningMap } from '@/hooks/useLearningMap';
import LearningMap from '@/components/student/learning-map/LearningMap';

type LearningMapClientProps = {
  studentId: string;
};

export default function LearningMapClient({ studentId }: LearningMapClientProps) {
  const { data, isLoading, error, isOfflineCache, refresh } = useLearningMap(studentId);

  if (isLoading && data.chapters.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-28 animate-pulse rounded-2xl bg-gray-100" />
        <div className="mt-5 h-44 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-[#BA7517] bg-[#FAEEDA] px-4 py-3 text-sm text-[#BA7517]">
          Could not fully refresh learning map. Showing latest available data.
        </div>
      )}
      <LearningMap studentId={studentId} data={data} isOfflineCache={isOfflineCache} onRefresh={refresh} />
    </>
  );
}
