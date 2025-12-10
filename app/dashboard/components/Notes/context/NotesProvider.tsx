"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { StubNotesService as _StubNotesService } from '../services/StubNotesService';

export type NoteSubject = { name: string; meta: string };
export type NoteEntry = { id: string; title: string };

export interface NotesService {
  fetchSubjects(): Promise<NoteSubject[]>;
  fetchBookmarked(): Promise<NoteEntry[]>;
  fetchDownloaded(): Promise<NoteEntry[]>;
  fetchRecentlyAdded(): Promise<NoteEntry[]>;
}

class StubNotesService implements NotesService {
  async fetchSubjects() {
    return [
      { name: 'Mathematics', meta: '24 chapters' },
      { name: 'Science', meta: '18 chapters' },
      { name: 'English', meta: '12 chapters' },
      { name: 'Social Studies', meta: '15 chapters' },
    ];
  }
  async fetchBookmarked() {
    return [
      { id: 'b1', title: 'Triangles & Properties' },
      { id: 'b2', title: 'Photosynthesis Process' },
      { id: 'b3', title: 'Grammar Rules' },
    ];
  }
  async fetchDownloaded() {
    return [
      { id: 'd1', title: 'Algebra Basics' },
      { id: 'd2', title: 'Chemical Reactions' },
    ];
  }
  async fetchRecentlyAdded() {
    return [
      { id: 'r1', title: 'Latest notes from your syllabus' },
    ];
  }
}

// Prevent unused class warning when not injected
void StubNotesService;

export class HttpNotesService implements NotesService {
  async fetchSubjects() {
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
  subjects: NoteSubject[];
  bookmarked: NoteEntry[];
  downloaded: NoteEntry[];
  recent: NoteEntry[];
  loading: boolean;
};

export type NotesAPI = NotesState & {
  setQuery: (q: string) => void;
  refresh: () => Promise<void>;
  trackDownloadClick: () => void;
};

const Ctx = createContext<NotesAPI | null>(null);

export function NotesProvider({ children, service }: { children: React.ReactNode; service?: NotesService }) {
  const svc = useMemo(() => service ?? new HttpNotesService(), [service]);
  const [state, setState] = useState<NotesState>({ query: '', subjects: [], bookmarked: [], downloaded: [], recent: [], loading: false });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [subjects, bookmarked, downloaded, recent] = await Promise.all([
        svc.fetchSubjects(), svc.fetchBookmarked(), svc.fetchDownloaded(), svc.fetchRecentlyAdded(),
      ]);
      setState((s) => ({ ...s, subjects, bookmarked, downloaded, recent }));
      logger.info('notes.refresh');
    } catch (e) {
      logger.warn('notes.refresh.error', { message: String(e) });
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [svc]);

  const setQuery = useCallback((q: string) => {
    setState((s) => ({ ...s, query: q }));
    logger.info('notes.search', { q });
  }, []);

  const trackDownloadClick = useCallback(() => {
    logger.info('notes.download.click');
  }, []);

  const api: NotesAPI = {
    ...state,
    setQuery,
    refresh,
    trackDownloadClick,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

void _StubNotesService;
export function useNotes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
}
