/**
 * FILE OBJECTIVE:
 * - Shared cascading dropdown filters for Language → Board → Grade → Subject → Chapter → Topic.
 * - Reusable across Notes, Tests, and other content browsing pages.
 * - Uses single hierarchy API with session-level caching (no repeated fetches).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/CascadingFilters.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created cascading filter component
 * - 2026-02-03 | claude | refactored to use single hierarchy API with session caching
 */

'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import {
  useAcademicHierarchy,
  HierarchyBoard,
  HierarchyClass,
  HierarchySubject,
  HierarchyChapter,
  HierarchyTopic,
} from '@/hooks/useAcademicHierarchy';
import useCurrentUser from '@/hooks/useCurrentUser';

// Re-export types for backward compatibility
export type { HierarchyBoard, HierarchyClass, HierarchySubject, HierarchyChapter, HierarchyTopic };

export type LanguageCode = 'en' | 'hi';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/** Languages available for content */
export const LANGUAGES = [
  { code: 'en' as const, name: 'English' },
  { code: 'hi' as const, name: 'हिंदी (Hindi)' },
];

/** Difficulty levels for tests/questions */
export const DIFFICULTY_LEVELS = [
  { value: 'easy' as const, label: 'Easy' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'hard' as const, label: 'Hard' },
];

export interface CascadingFilterState {
  language: LanguageCode | null;
  boardSlug: string | null;
  boardId: string | null;
  gradeNum: number | null;
  gradeId: string | null;
  subjectSlug: string | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
  difficulty: DifficultyLevel | null;
}

export interface CascadingFiltersProps {
  /** Current filter state */
  value: CascadingFilterState;
  /** Callback when any filter changes */
  onChange: (state: CascadingFilterState) => void;
  /** Auto-initialize language, board, grade from user profile (default: false) */
  useProfileDefaults?: boolean;
  /** Show language selector (default: true) */
  showLanguage?: boolean;
  /** Show difficulty selector (default: false) */
  showDifficulty?: boolean;
  /** Show chapter selector (default: true, set false to go Board→Grade→Subject→Topic directly) */
  showChapter?: boolean;
  /** Stop cascade at this level (e.g., 'subject' to not show chapters/topics) */
  stopAt?: 'language' | 'board' | 'grade' | 'subject' | 'chapter' | 'topic';
  /** Additional className for the container */
  className?: string;
  /** Layout: 'horizontal' for row, 'vertical' for column, 'grid' for responsive grid */
  layout?: 'horizontal' | 'vertical' | 'grid';
  /** Compact mode reduces padding and font size */
  compact?: boolean;
}

/** Create empty filter state */
export function createEmptyFilterState(): CascadingFilterState {
  return {
    language: null,
    boardSlug: null,
    boardId: null,
    gradeNum: null,
    gradeId: null,
    subjectSlug: null,
    subjectId: null,
    chapterId: null,
    topicId: null,
    difficulty: null,
  };
}

/** Create filter state from user profile */
export function createFilterStateFromProfile(profile: {
  language?: string | null;
  board?: string | null;
  grade?: number | null;
}): CascadingFilterState {
  return {
    language: (profile.language as LanguageCode) ?? 'en',
    boardSlug: profile.board ?? null,
    boardId: null, // Will be resolved when hierarchy loads
    gradeNum: profile.grade ?? null,
    gradeId: null, // Will be resolved when hierarchy loads
    subjectSlug: null,
    subjectId: null,
    chapterId: null,
    topicId: null,
    difficulty: null,
  };
}

/**
 * Shared cascading dropdown filters component.
 *
 * Uses a SINGLE hierarchy API call that is session-cached.
 * All dropdown data is derived from the cached hierarchy.
 *
 * Cascade order: Language → Board → Grade → Subject → Chapter → Topic
 *
 * When a higher-level filter changes, all lower-level selections are reset.
 */
export default function CascadingFilters({
  value,
  onChange,
  useProfileDefaults = false,
  showLanguage = true,
  showDifficulty = false,
  showChapter = true,
  stopAt,
  className = '',
  layout = 'grid',
  compact = false,
}: CascadingFiltersProps) {
  // Single hierarchy fetch with session caching
  const { hierarchy, loading, helpers } = useAcademicHierarchy();
  
  // User profile for auto-initialization (only fetched if useProfileDefaults is true)
  const { data: profile, loading: profileLoading } = useCurrentUser();
  
  // Track if we've already initialized from profile to avoid re-initializing
  const hasInitializedFromProfile = useRef(false);

  // Derive dropdown data from cached hierarchy
  const boards = helpers.getBoards();
  const grades = helpers.getGradesForBoard(value.boardSlug ?? value.boardId);
  const subjects = helpers.getSubjectsForGrade(value.boardSlug ?? value.boardId, value.gradeNum);
  const chapters = helpers.getChaptersForSubject(value.subjectId);
  const topics = showChapter
    ? helpers.getTopicsForChapter(value.chapterId)
    : helpers.getTopicsForSubject(value.subjectId);
  const languages = helpers.getLanguages();
  const difficulties = helpers.getDifficulties();

  // Determine which levels to show
  const showBoard = !stopAt || ['board', 'grade', 'subject', 'chapter', 'topic'].includes(stopAt);
  const showGrade = !stopAt || ['grade', 'subject', 'chapter', 'topic'].includes(stopAt);
  const showSubject = !stopAt || ['subject', 'chapter', 'topic'].includes(stopAt);
  const showChapterSelect = showChapter && (!stopAt || ['chapter', 'topic'].includes(stopAt));
  const showTopic = !stopAt || stopAt === 'topic';

  // Layout classes
  const containerClass = {
    horizontal: 'flex flex-wrap gap-2 items-end',
    vertical: 'flex flex-col gap-3',
    grid: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3',
  }[layout];

  const selectClass = compact
    ? 'px-2 py-1 text-sm border rounded w-full dark:bg-gray-700 dark:border-gray-600'
    : 'px-3 py-2 border rounded w-full dark:bg-gray-700 dark:border-gray-600';

  // Handlers that reset downstream selections
  const handleLanguageChange = useCallback(
    (lang: string) => {
      onChange({
        ...value,
        language: lang as LanguageCode,
      });
    },
    [value, onChange]
  );

  const handleBoardChange = useCallback(
    (boardId: string) => {
      const board = boards.find((b) => b.id === boardId);
      onChange({
        ...value,
        boardSlug: board?.slug ?? null,
        boardId: boardId || null,
        gradeNum: null,
        gradeId: null,
        subjectSlug: null,
        subjectId: null,
        chapterId: null,
        topicId: null,
      });
    },
    [value, onChange, boards]
  );

  const handleGradeChange = useCallback(
    (gradeId: string) => {
      const grade = grades.find((g) => g.id === gradeId);
      onChange({
        ...value,
        gradeNum: grade?.grade ?? null,
        gradeId: gradeId || null,
        subjectSlug: null,
        subjectId: null,
        chapterId: null,
        topicId: null,
      });
    },
    [value, onChange, grades]
  );

  const handleSubjectChange = useCallback(
    (subjectId: string) => {
      const subject = subjects.find((s) => s.id === subjectId);
      onChange({
        ...value,
        subjectSlug: subject?.slug ?? null,
        subjectId: subjectId || null,
        chapterId: null,
        topicId: null,
      });
    },
    [value, onChange, subjects]
  );

  const handleChapterChange = useCallback(
    (chapterId: string) => {
      onChange({
        ...value,
        chapterId: chapterId || null,
        topicId: null,
      });
    },
    [value, onChange]
  );

  const handleTopicChange = useCallback(
    (topicId: string) => {
      onChange({
        ...value,
        topicId: topicId || null,
      });
    },
    [value, onChange]
  );

  const handleDifficultyChange = useCallback(
    (diff: string) => {
      onChange({
        ...value,
        difficulty: (diff || null) as DifficultyLevel | null,
      });
    },
    [value, onChange]
  );

  // Auto-initialize from user profile when useProfileDefaults is enabled
  useEffect(() => {
    if (!useProfileDefaults || profileLoading || hasInitializedFromProfile.current) return;
    if (!profile) return;
    
    // Only initialize if no selections have been made yet
    const isEmpty = !value.language && !value.boardSlug && !value.boardId;
    if (!isEmpty) {
      hasInitializedFromProfile.current = true;
      return;
    }

    hasInitializedFromProfile.current = true;
    
    // Initialize from profile
    onChange(createFilterStateFromProfile({
      language: profile.language,
      board: profile.board,
      grade: profile.grade,
    }));
  }, [useProfileDefaults, profile, profileLoading, value, onChange]);

  // Auto-resolve IDs when hierarchy loads and we have slugs/numbers
  useEffect(() => {
    if (!hierarchy || loading) return;

    let needsUpdate = false;
    const updates: Partial<CascadingFilterState> = {};

    // Resolve boardId from boardSlug
    if (value.boardSlug && !value.boardId) {
      const board = helpers.findBoard(value.boardSlug);
      if (board) {
        updates.boardId = board.id;
        needsUpdate = true;
      }
    }

    // Resolve gradeId from gradeNum
    if (value.gradeNum && !value.gradeId && (value.boardSlug || value.boardId)) {
      const grade = helpers.findGrade(value.boardSlug ?? value.boardId, value.gradeNum);
      if (grade) {
        updates.gradeId = grade.id;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      onChange({ ...value, ...updates });
    }
  }, [hierarchy, loading, value, helpers, onChange]);

  return (
    <div className={`${containerClass} ${className}`}>
      {/* Language Selector */}
      {showLanguage && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Language
          </label>
          <select
            value={value.language ?? ''}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Select Language</option>
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Board Selector */}
      {showBoard && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Board
          </label>
          <select
            value={value.boardId ?? ''}
            onChange={(e) => handleBoardChange(e.target.value)}
            disabled={loading}
            className={`${selectClass} ${loading ? 'opacity-50' : ''}`}
          >
            <option value="">{loading ? 'Loading...' : 'Select Board'}</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Grade Selector */}
      {showGrade && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Grade
          </label>
          <select
            value={value.gradeId ?? ''}
            onChange={(e) => handleGradeChange(e.target.value)}
            disabled={!value.boardId}
            className={`${selectClass} ${!value.boardId ? 'opacity-50' : ''}`}
          >
            <option value="">{!value.boardId ? 'Select Board first' : 'Select Grade'}</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                Class {grade.grade}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Subject Selector */}
      {showSubject && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Subject
          </label>
          <select
            value={value.subjectId ?? ''}
            onChange={(e) => handleSubjectChange(e.target.value)}
            disabled={!value.gradeId}
            className={`${selectClass} ${!value.gradeId ? 'opacity-50' : ''}`}
          >
            <option value="">{!value.gradeId ? 'Select Grade first' : 'Select Subject'}</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chapter Selector (optional) */}
      {showChapterSelect && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Chapter
          </label>
          <select
            value={value.chapterId ?? ''}
            onChange={(e) => handleChapterChange(e.target.value)}
            disabled={!value.subjectId}
            className={`${selectClass} ${!value.subjectId ? 'opacity-50' : ''}`}
          >
            <option value="">{!value.subjectId ? 'Select Subject first' : 'All Chapters'}</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.order}. {chapter.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Topic Selector */}
      {showTopic && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Topic
          </label>
          <select
            value={value.topicId ?? ''}
            onChange={(e) => handleTopicChange(e.target.value)}
            disabled={showChapter ? !value.chapterId : !value.subjectId}
            className={`${selectClass} ${(showChapter ? !value.chapterId : !value.subjectId) ? 'opacity-50' : ''}`}
          >
            <option value="">
              {showChapter && !value.chapterId
                ? 'Select Chapter first'
                : !value.subjectId
                  ? 'Select Subject first'
                  : 'Select Topic'}
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Difficulty Selector */}
      {showDifficulty && (
        <div className="flex flex-col">
          <label className={`text-xs text-muted-foreground mb-1 ${compact ? '' : 'font-medium'}`}>
            Difficulty
          </label>
          <select
            value={value.difficulty ?? ''}
            onChange={(e) => handleDifficultyChange(e.target.value)}
            className={selectClass}
          >
            <option value="">All Levels</option>
            {difficulties.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
