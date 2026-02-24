/**
 * FILE OBJECTIVE:
 * - Provides Notes tab state and API for fetching subjects, bookmarks, downloads, recent notes.
 * - Uses session-cached hierarchy API for subject filtering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/context/NotesProvider.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | fixed auto-refresh on profile load for subject dropdown
 * - 2026-02-03 | claude | refactored to use session-cached hierarchy API
 */

"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import useCurrentUser from '@/hooks/useCurrentUser';
import type { AcademicHierarchyResponse, HierarchySubject } from '@/hooks/useAcademicHierarchy';

export type NoteSubject = { name: string; meta: string };
export type NoteEntry = { id: string; title: string };

// Cache for hierarchy data (session-level)
let hierarchyCache: AcademicHierarchyResponse | null = null;

export interface NotesService {
  fetchSubjects(boardSlug?: string, gradeNum?: string): Promise<NoteSubject[]>;
  fetchBookmarked(): Promise<NoteEntry[]>;
  fetchDownloaded(): Promise<NoteEntry[]>;
  fetchRecentlyAdded(): Promise<NoteEntry[]>;
}

export class HttpNotesService implements NotesService {
  async fetchSubjects(boardSlug?: string, gradeNum?: string) {
    // Use cached hierarchy when board + grade are known
    if (boardSlug && gradeNum) {
      // Fetch hierarchy if not cached
      if (!hierarchyCache) {
        const res = await fetch('/api/academic-hierarchy');
        if (res.ok) {
          hierarchyCache = await res.json();
        }
      }
      
      if (hierarchyCache) {
        const board = hierarchyCache.boards.find(
          (b) => b.slug.toLowerCase() === boardSlug.toLowerCase() || b.id === boardSlug
        );
        const cls = board?.classes.find((c) => c.grade === parseInt(gradeNum, 10));
        const subjects = cls?.subjects ?? [];
        return subjects.map((s: HierarchySubject) => ({
          name: s.name,
          meta: '',
        }));
      }
    }
    
    // Fallback: existing notes/subjects endpoint without classId
    const res = await fetch('/api/notes/subjects');
    if (!res.ok) return [];
    return (await res.json()).subjects ?? [];
  }
  async fetchBookmarked() {
    const res = await fetch('/api/notes/bookmarked');
    if (!res.ok) return [];
    return (await res.json()).notes ?? [];
  }
  async fetchDownloaded() {
    const res = await fetch('/api/notes/downloaded');
    if (!res.ok) return [];
    return (await res.json()).notes ?? [];
  }
  async fetchRecentlyAdded() {
    const res = await fetch('/api/notes/recent');
    if (!res.ok) return [];
    return (await res.json()).notes ?? [];
  }
}

export type NotesState = {
  query: string;
  filters?: {
    language?: string | null;
    board?: string | null;
    grade?: string | null;
    subject?: string | null;
    topic?: string | null;
  };
  subjects: NoteSubject[];
  bookmarked: NoteEntry[];
  downloaded: NoteEntry[];
  recent: NoteEntry[];
  loading: boolean;
};

export type NotesAPI = NotesState & {
  setQuery: (q: string) => void;
  setFilters: (f: Partial<NonNullable<NotesState['filters']>>) => void;
  refresh: () => Promise<void>;
  recordDownload: (noteId: string) => Promise<void>;
};

const Ctx = createContext<NotesAPI | null>(null);

export function NotesProvider({ children, service }: { children: React.ReactNode; service?: NotesService }) {
  const svc = useMemo(() => service ?? new HttpNotesService(), [service]);
  const { data: profile, loading: profileLoading } = useCurrentUser();
  const [state, setState] = useState<NotesState>({ query: '', filters: undefined, subjects: [], bookmarked: [], downloaded: [], recent: [], loading: false });
  
  // Track previous profile values to detect changes
  const prevProfileRef = useRef<{ board: string | null; grade: number | null }>({ board: null, grade: null });
  const hasFetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const boardSlug = profile?.board ? String(profile.board) : undefined;
      const gradeNum = profile?.grade ? String(profile.grade) : undefined;
      const [subjects, bookmarked, downloaded, recent] = await Promise.all([
        svc.fetchSubjects(boardSlug, gradeNum), svc.fetchBookmarked(), svc.fetchDownloaded(), svc.fetchRecentlyAdded(),
      ]);
      setState((s) => ({ ...s, subjects, bookmarked, downloaded, recent }));
      logger.info('notes.refresh', { boardSlug, gradeNum, subjectCount: subjects.length });
    } catch (e) {
      logger.warn('notes.refresh.error', { message: String(e) });
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [svc, profile?.board, profile?.grade]);

  // Auto-refresh when profile loads or changes
  useEffect(() => {
    // Skip if profile is still loading
    if (profileLoading) return;
    
    const currentBoard = profile?.board ?? null;
    const currentGrade = profile?.grade ?? null;
    const prev = prevProfileRef.current;
    
    // Fetch if: first time after profile load, or profile values changed
    if (!hasFetchedRef.current || prev.board !== currentBoard || prev.grade !== currentGrade) {
      hasFetchedRef.current = true;
      prevProfileRef.current = { board: currentBoard, grade: currentGrade };
      refresh();
    }
  }, [profileLoading, profile?.board, profile?.grade, refresh]);

  const setQuery = useCallback((q: string) => {
    setState((s) => ({ ...s, query: q }));
    logger.info('notes.search', { q });
  }, []);

  const setFilters = useCallback((f: Partial<NonNullable<NotesState['filters']>>) => {
    setState((s) => ({ ...s, filters: { ...(s.filters || {}), ...f } }));
    logger.info('notes.filters.updated', { f });
  }, []);

  const recordDownload = useCallback(async (noteId: string) => {
    try {
      await fetch('/api/notes/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId }) });
      logger.info('notes.download.recorded', { noteId });
    } catch (e) {
      logger.warn('notes.download.error', { message: String(e) });
    }
  }, []);

  const api: NotesAPI = {
    ...state,
    setQuery,
    setFilters,
    refresh,
    recordDownload,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useNotes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
}
