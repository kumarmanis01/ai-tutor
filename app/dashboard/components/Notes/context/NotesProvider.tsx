"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import useCurrentUser from '@/hooks/useCurrentUser';

export type NoteSubject = { name: string; meta: string };
export type NoteEntry = { id: string; title: string };

export interface NotesService {
  fetchSubjects(classId?: string): Promise<NoteSubject[]>;
  fetchBookmarked(): Promise<NoteEntry[]>;
  fetchDownloaded(): Promise<NoteEntry[]>;
  fetchRecentlyAdded(): Promise<NoteEntry[]>;
}

export class HttpNotesService implements NotesService {
  async fetchSubjects(classId?: string) {
    const url = '/api/notes/subjects' + (classId ? `?classId=${encodeURIComponent(classId)}` : '');
    const res = await fetch(url);
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
  const { data: profile } = useCurrentUser();
  const [state, setState] = useState<NotesState>({ query: '', filters: undefined, subjects: [], bookmarked: [], downloaded: [], recent: [], loading: false });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const classId = profile?.grade ? String(profile.grade) : undefined;
      const [subjects, bookmarked, downloaded, recent] = await Promise.all([
        svc.fetchSubjects(classId), svc.fetchBookmarked(), svc.fetchDownloaded(), svc.fetchRecentlyAdded(),
      ]);
      setState((s) => ({ ...s, subjects, bookmarked, downloaded, recent }));
      logger.info('notes.refresh');
    } catch (e) {
      logger.warn('notes.refresh.error', { message: String(e) });
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [svc, profile?.grade]);

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
