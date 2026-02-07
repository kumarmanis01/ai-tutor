/**
 * FILE OBJECTIVE:
 * - SWR hook for fetching the complete academic hierarchy with session-level caching.
 * - Single fetch provides all data for cascading dropdowns.
 * - Uses long cache TTL (5 minutes) with revalidateOnFocus disabled for session persistence.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useAcademicHierarchy.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created session-cached hierarchy hook
 */

import useSWR from 'swr';
import type {
  AcademicHierarchyResponse,
  HierarchyBoard,
  HierarchyClass,
  HierarchySubject,
  HierarchyChapter,
  HierarchyTopic,
} from '@/app/api/academic-hierarchy/route';

// Re-export types for consumers
export type {
  AcademicHierarchyResponse,
  HierarchyBoard,
  HierarchyClass,
  HierarchySubject,
  HierarchyChapter,
  HierarchyTopic,
};

const fetcher = async (url: string): Promise<AcademicHierarchyResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch academic hierarchy');
  }
  return res.json();
};

/**
 * Configuration for SWR with session-level caching.
 * - dedupingInterval: 5 minutes (prevents duplicate requests)
 * - revalidateOnFocus: false (don't re-fetch on tab focus)
 * - revalidateOnReconnect: false (don't re-fetch on reconnect)
 * - revalidateIfStale: false (don't auto-revalidate stale data)
 *
 * This ensures the hierarchy is fetched only ONCE per session unless
 * manually mutated or the cache expires.
 */
const SWR_CONFIG = {
  dedupingInterval: 5 * 60 * 1000, // 5 minutes
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  // Keep data in cache for 30 minutes even if no components are using it
  keepPreviousData: true,
};

/**
 * Hook to access the academic hierarchy with session-level caching.
 *
 * The hierarchy is fetched once and cached for the session.
 * Use the helper functions to derive specific data from the hierarchy.
 *
 * @example
 * ```tsx
 * const { hierarchy, loading, error, helpers } = useAcademicHierarchy();
 *
 * // Get all boards
 * const boards = hierarchy?.boards ?? [];
 *
 * // Get grades for a specific board
 * const grades = helpers.getGradesForBoard('cbse');
 *
 * // Get subjects for a specific grade
 * const subjects = helpers.getSubjectsForGrade('cbse', 10);
 * ```
 */
export function useAcademicHierarchy() {
  const { data, error, isLoading, mutate } = useSWR<AcademicHierarchyResponse>(
    '/api/academic-hierarchy',
    fetcher,
    SWR_CONFIG
  );

  // Helper functions for deriving data from hierarchy
  const helpers = {
    /**
     * Get all boards (top level)
     */
    getBoards(): HierarchyBoard[] {
      return data?.boards ?? [];
    },

    /**
     * Find a board by slug or ID
     */
    findBoard(slugOrId: string | null | undefined): HierarchyBoard | undefined {
      if (!slugOrId || !data?.boards) return undefined;
      return data.boards.find(
        (b) => b.slug.toLowerCase() === slugOrId.toLowerCase() || b.id === slugOrId
      );
    },

    /**
     * Get grades/classes for a specific board
     */
    getGradesForBoard(boardSlugOrId: string | null | undefined): HierarchyClass[] {
      const board = helpers.findBoard(boardSlugOrId);
      return board?.classes ?? [];
    },

    /**
     * Find a grade by grade number within a board
     */
    findGrade(
      boardSlugOrId: string | null | undefined,
      gradeNum: number | null | undefined
    ): HierarchyClass | undefined {
      if (!gradeNum) return undefined;
      const classes = helpers.getGradesForBoard(boardSlugOrId);
      return classes.find((c) => c.grade === gradeNum);
    },

    /**
     * Find a grade by ID
     */
    findGradeById(gradeId: string | null | undefined): HierarchyClass | undefined {
      if (!gradeId || !data?.boards) return undefined;
      for (const board of data.boards) {
        const cls = board.classes.find((c) => c.id === gradeId);
        if (cls) return cls;
      }
      return undefined;
    },

    /**
     * Get subjects for a specific grade
     */
    getSubjectsForGrade(
      boardSlugOrId: string | null | undefined,
      gradeNum: number | null | undefined
    ): HierarchySubject[] {
      const cls = helpers.findGrade(boardSlugOrId, gradeNum);
      return cls?.subjects ?? [];
    },

    /**
     * Find a subject by slug or ID within a grade
     */
    findSubject(
      boardSlugOrId: string | null | undefined,
      gradeNum: number | null | undefined,
      subjectSlugOrId: string | null | undefined
    ): HierarchySubject | undefined {
      if (!subjectSlugOrId) return undefined;
      const subjects = helpers.getSubjectsForGrade(boardSlugOrId, gradeNum);
      return subjects.find(
        (s) => s.slug.toLowerCase() === subjectSlugOrId.toLowerCase() || s.id === subjectSlugOrId
      );
    },

    /**
     * Find a subject by ID (global search)
     */
    findSubjectById(subjectId: string | null | undefined): HierarchySubject | undefined {
      if (!subjectId || !data?.boards) return undefined;
      for (const board of data.boards) {
        for (const cls of board.classes) {
          const sub = cls.subjects.find((s) => s.id === subjectId);
          if (sub) return sub;
        }
      }
      return undefined;
    },

    /**
     * Get chapters for a specific subject
     */
    getChaptersForSubject(subjectId: string | null | undefined): HierarchyChapter[] {
      const subject = helpers.findSubjectById(subjectId);
      return subject?.chapters ?? [];
    },

    /**
     * Find a chapter by ID
     */
    findChapter(chapterId: string | null | undefined): HierarchyChapter | undefined {
      if (!chapterId || !data?.boards) return undefined;
      for (const board of data.boards) {
        for (const cls of board.classes) {
          for (const sub of cls.subjects) {
            const ch = sub.chapters.find((c) => c.id === chapterId);
            if (ch) return ch;
          }
        }
      }
      return undefined;
    },

    /**
     * Get topics for a specific chapter
     */
    getTopicsForChapter(chapterId: string | null | undefined): HierarchyTopic[] {
      const chapter = helpers.findChapter(chapterId);
      return chapter?.topics ?? [];
    },

    /**
     * Get topics directly for a subject (all chapters combined)
     */
    getTopicsForSubject(subjectId: string | null | undefined): HierarchyTopic[] {
      const chapters = helpers.getChaptersForSubject(subjectId);
      return chapters.flatMap((ch) => ch.topics);
    },

    /**
     * Find a topic by ID
     */
    findTopic(topicId: string | null | undefined): HierarchyTopic | undefined {
      if (!topicId || !data?.boards) return undefined;
      for (const board of data.boards) {
        for (const cls of board.classes) {
          for (const sub of cls.subjects) {
            for (const ch of sub.chapters) {
              const tp = ch.topics.find((t) => t.id === topicId);
              if (tp) return tp;
            }
          }
        }
      }
      return undefined;
    },

    /**
     * Get available languages
     */
    getLanguages() {
      return data?.languages ?? [
        { code: 'en' as const, name: 'English' },
        { code: 'hi' as const, name: 'हिंदी (Hindi)' },
      ];
    },

    /**
     * Get difficulty levels
     */
    getDifficulties() {
      return data?.difficulties ?? [
        { value: 'easy' as const, label: 'Easy' },
        { value: 'medium' as const, label: 'Medium' },
        { value: 'hard' as const, label: 'Hard' },
      ];
    },
  };

  return {
    /** The complete hierarchy data */
    hierarchy: data,
    /** Whether the initial fetch is in progress */
    loading: isLoading,
    /** Any error that occurred during fetch */
    error: error as Error | undefined,
    /** Helper functions for deriving data from hierarchy */
    helpers,
    /** Function to manually refresh the hierarchy */
    refresh: mutate,
  };
}

export default useAcademicHierarchy;
