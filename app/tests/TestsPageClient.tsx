/**
 * FILE OBJECTIVE:
 * - Client component for /tests page with cascading filters for content selection.
 * - Language → Board → Grade → Subject → Topic → Difficulty → Questions/Tests
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/tests/TestsPageClient.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created dynamic tests page client
 * - 2026-02-03 | claude | upgraded to cascading filters
 */

'use client';

import React, { useState, useEffect } from 'react';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';
import CascadingFilters, {
  CascadingFilterState,
  createEmptyFilterState,
  createFilterStateFromProfile,
} from '@/components/CascadingFilters';
import { useQuestionsForTopic } from '@/hooks/useQuestionsForTopic';
import QuickPractice from '@/components/Test/QuickPractice';
import ChapterTests from '@/components/Test/ChapterTests';
import WeeklyChallenge from '@/components/Test/WeeklyChallenge';
import TestHistory from '@/components/Test/TestHistory';

export default function TestsPageClient() {
  const { data: profile, loading: profileLoading } = useCurrentUser();
  const { helpers } = useAcademicHierarchy();
  const [filters, setFilters] = useState<CascadingFilterState>(createEmptyFilterState());

  // Initialize filters from user profile when loaded
  useEffect(() => {
    if (profile && !filters.boardSlug) {
      setFilters(createFilterStateFromProfile({
        language: profile.language,
        board: profile.board,
        grade: profile.grade,
      }));
    }
  }, [profile, filters.boardSlug]);

  // Fetch tests for selected topic
  const { tests, loading: testsLoading } = useQuestionsForTopic(
    filters.topicId,
    filters.difficulty,
    filters.language
  );

  if (profileLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-16 bg-gray-200 rounded mb-4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Practice Tests</h1>
        <p className="text-sm text-muted-foreground">
          Select your preferences to find tests and questions
        </p>
      </div>

      {/* Cascading Filters */}
      <div className="bg-card border rounded-lg p-4">
        <CascadingFilters
          value={filters}
          onChange={setFilters}
          showLanguage={true}
          showDifficulty={true}
          showChapter={false} // Skip chapter, go Subject → Topic directly
          layout="grid"
        />
      </div>

      {/* Topic-specific tests when a topic is selected */}
      {filters.topicId && (
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Available Tests</h2>
          {testsLoading ? (
            <div className="text-sm text-muted-foreground">Loading tests...</div>
          ) : tests.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No tests available for this topic
              {filters.difficulty && ` at ${filters.difficulty} difficulty`}.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="p-3 border rounded hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="font-medium">{test.title}</div>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{test.difficulty}</span>
                    <span>•</span>
                    <span>{test.questionCount} questions</span>
                    <span>•</span>
                    <span>{test.language === 'en' ? 'English' : 'Hindi'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* General test components (use filter values) */}
      <QuickPractice
        subject={filters.subjectSlug || undefined}
        grade={filters.gradeNum ? String(filters.gradeNum) : undefined}
        board={filters.boardSlug ?? undefined}
        questionCount={8}
      />
      <ChapterTests
        subject={filters.subjectSlug || undefined}
        grade={filters.gradeNum ? String(filters.gradeNum) : undefined}
        board={filters.boardSlug ?? undefined}
        chapters={helpers.getChaptersForSubject(filters.subjectId).map(c => ({ id: c.id, name: c.name }))}
      />
      <TestHistory />
      <WeeklyChallenge />
    </div>
  );
}

