'use client';
/**
 * FILE OBJECTIVE:
 * - Display recently added notes with navigation handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/sections/NotesRecentlyAdded.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for note navigation
 */
import React, { useCallback } from 'react';
import { NotesSection } from './NotesSection';
import { useNotes, NoteEntry } from '../context/NotesProvider';

export function NotesRecentlyAdded() {
  const { recent, loading } = useNotes();

  const openNote = useCallback((note: NoteEntry) => {
    // Navigate to learn page with note ID and type for proper context
    const params = new URLSearchParams();
    params.set('noteId', note.id);
    params.set('type', 'note');
    window.location.assign(`/learn?${params.toString()}`);
  }, []);

  return (
    <NotesSection title="Recently Added">
      {loading && recent.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : recent.length === 0 ? (
        <div className="text-sm text-muted-foreground">No recent notes</div>
      ) : (
        <div className="space-y-2">
          {recent.map((n) => (
            <div key={n.id} className="w-full flex items-center gap-2 px-1">
              <button
                onClick={() => openNote(n)}
                className="flex-1 px-3 py-2 border rounded text-left flex items-center gap-2 hover:bg-muted/50 active:scale-[0.98] transition-transform"
                aria-label={`Open recent note ${n.title}`}
              >
                <span className="text-lg">🆕</span>
                <span className="flex-1 truncate text-sm">{n.title}</span>
              </button>

              <div className="flex-shrink-0">
                <button
                  onClick={() => {
                    const topicId = (n as any).topicId || (n as any).topic || '';
                    const params = new URLSearchParams();
                    if (topicId) params.set('topicId', topicId);
                    window.location.assign(`/tests?${params.toString()}`);
                  }}
                  className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium rounded-md"
                  aria-label={`Practice for ${n.title}`}
                >
                  Practice →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </NotesSection>
  );
}
