'use client';
/**
 * FILE OBJECTIVE:
 * - Display downloaded notes with navigation handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/sections/NotesDownloaded.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for note navigation
 */
import React, { useCallback } from 'react';
import { NotesSection } from './NotesSection';
import { useNotes, NoteEntry } from '../context/NotesProvider';

export function NotesDownloaded() {
  const { downloaded, loading } = useNotes();
  
  const openNote = useCallback((note: NoteEntry) => {
    // Navigate to learn page with note ID and type for proper context
    const params = new URLSearchParams();
    params.set('noteId', note.id);
    params.set('type', 'note');
    window.location.assign(`/learn?${params.toString()}`);
  }, []);

  return (
    <NotesSection title="Downloaded (Offline)">
      {loading && downloaded.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : downloaded.length === 0 ? (
        <div className="text-sm text-muted-foreground">No downloaded notes</div>
      ) : (
        <div className="space-y-2">
          {downloaded.map((n) => (
            <button 
              key={n.id} 
              onClick={() => openNote(n)}
              className="w-full px-3 py-2 border rounded text-left flex items-center gap-2 hover:bg-muted/50 active:scale-[0.98] transition-transform"
            >
              <span className="text-lg">📥</span>
              <span className="flex-1 truncate">{n.title}</span>
              <span className="text-primary">→</span>
            </button>
          ))}
        </div>
      )}
    </NotesSection>
  );
}
