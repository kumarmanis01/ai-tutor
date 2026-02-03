'use client';
/**
 * FILE OBJECTIVE:
 * - Display notes grouped by subject with navigation handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/sections/NotesBySubject.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for subject navigation
 */
import React, { useCallback } from 'react';
import { NotesSection } from './NotesSection';
import { useNotes, NoteSubject } from '../context/NotesProvider';

export function NotesBySubject() {
  const { subjects, loading } = useNotes();
  
  const navigateToSubject = useCallback((subject: NoteSubject) => {
    const params = new URLSearchParams();
    params.set('subject', subject.name);
    params.set('type', 'notes');
    window.location.assign(`/learn?${params.toString()}`);
  }, []);

  return (
    <NotesSection title="By Subject">
      {loading && subjects.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : subjects.length === 0 ? (
        <div className="text-sm text-muted-foreground">No subjects found</div>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <button 
              key={s.name} 
              onClick={() => navigateToSubject(s)}
              className="w-full flex items-center justify-between px-3 py-2 border rounded hover:bg-muted/50 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📚</span>
                <span className="font-medium">{s.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{s.meta}</span>
                <span className="text-primary">→</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </NotesSection>
  );
}
