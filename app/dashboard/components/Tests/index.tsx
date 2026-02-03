/**
 * FILE OBJECTIVE:
 * - Tests tab with cascading filters for Language → Board → Grade → Subject → Topic → Tests.
 * - Displays quick practice, chapter tests, test history, and weekly challenges.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Tests/index.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | added CascadingFilters for dynamic filtering
 * - 2026-02-03 | claude | use useProfileDefaults for auto-initialization
 */

"use client";

import React, { useState } from 'react';
import { TestsHeader } from './sections/TestsHeader';
import { TestsHome } from './sections/TestsHome';
import { TestsProvider, useTests } from './context/TestsProvider';
import CascadingFilters, {
  CascadingFilterState,
  createEmptyFilterState,
} from '@/components/CascadingFilters';
import { useQuestionsForTopic } from '@/hooks/useQuestionsForTopic';

function TestsFiltered() {
  const [filters, setFilters] = useState<CascadingFilterState>(createEmptyFilterState());

  // Fetch tests for selected topic
  const { tests, loading: testsLoading } = useQuestionsForTopic(
    filters.topicId,
    filters.difficulty,
    filters.language
  );

  return (
    <div className="space-y-4">
      {/* Cascading Filters - auto-initializes from user profile */}
      <div className="bg-card border rounded-lg p-3">
        <CascadingFilters
          value={filters}
          onChange={setFilters}
          useProfileDefaults={true}
          showLanguage={true}
          showDifficulty={true}
          showChapter={false}
          layout="grid"
          compact
        />
      </div>

      {/* Topic-specific tests when a topic is selected */}
      {filters.topicId && (
        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Tests for Selected Topic</h3>
          {testsLoading ? (
            <div className="text-sm text-muted-foreground">Loading tests...</div>
          ) : tests.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No tests available for this topic
              {filters.difficulty && ` at ${filters.difficulty} difficulty`}.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="p-3 border rounded hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="font-medium text-sm">{test.title}</div>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{test.difficulty}</span>
                    <span>•</span>
                    <span>{test.questionCount} Q</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestsContent({ subject, grade, board }: { subject: string; grade?: string; board?: string }) {
  const { refresh } = useTests();
  React.useEffect(() => { refresh(subject, grade, board); }, [refresh, subject, grade, board]);
  return (
    <div className="space-y-6 px-3 sm:px-4 py-4">
      <TestsHeader subject={subject} grade={grade} board={board} />
      <TestsFiltered />
      <TestsHome subject={subject} grade={grade} board={board} />
    </div>
  );
}

export default function TestsTab({ subject, grade, board }: { subject: string; grade?: string; board?: string }) {
  return (
    <TestsProvider>
      <TestsContent subject={subject} grade={grade} board={board} />
    </TestsProvider>
  );
}
