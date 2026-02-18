/**
 * FILE OBJECTIVE:
 * - Notes browser with cascading filters for Language → Board → Grade → Subject → Topic → Notes.
 * - Displays notes for the selected topic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/sections/NotesFiltered.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created notes browser with cascading filters
 * - 2026-02-03 | claude | use useProfileDefaults for auto-initialization
 */

'use client';

import React, { useState } from 'react';
import CascadingFilters, {
  CascadingFilterState,
  createEmptyFilterState,
} from '@/components/CascadingFilters';
import { useNotesForTopic } from '@/hooks/useNotesForTopic';
import { NotesSection } from './NotesSection';

export function NotesFiltered() {
  const [filters, setFilters] = useState<CascadingFilterState>(createEmptyFilterState());

  // Fetch notes for selected topic
  const { notes, loading: notesLoading } = useNotesForTopic(
    filters.topicId,
    filters.language
  );

  const handleNoteClick = (noteId: string) => {
    // Navigate to note viewer or open in modal
    const params = new URLSearchParams();
    params.set('noteId', noteId);
    window.location.assign(`/learn?${params.toString()}`);
  };

  return (
    <NotesSection title="Browse Notes">
      {/* Cascading Filters - auto-initializes from user profile */}
      <div className="mb-4">
        <CascadingFilters
          value={filters}
          onChange={setFilters}
          useProfileDefaults={true}
          showLanguage={true}
          showDifficulty={false}
          showChapter={false}
          layout="grid"
          compact
        />
      </div>

      {/* Notes List */}
      {!filters.topicId ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Select a topic above to view available notes
        </div>
      ) : notesLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading notes...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          No notes available for this topic
          {filters.language && ` in ${filters.language === 'en' ? 'English' : 'Hindi'}`}.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="w-full flex items-center justify-between px-3 py-3 border rounded hover:bg-muted/50 active:scale-[0.98] transition-all"
            >
              <button
                onClick={() => handleNoteClick(note.id)}
                className="flex-1 text-left flex items-center gap-3"
                aria-label={`Open note ${note.title}`}
              >
                <span className="text-lg">📝</span>
                <div>
                  <span className="font-medium">{note.title}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {note.language === 'en' ? 'English' : 'Hindi'}{note.version ? ` • v${note.version}` : ''}
                  </div>
                </div>
              </button>

              {/* Practice CTA - navigates to Practice/tests page using topicId when available */}
              <div className="ml-3 flex-shrink-0">
                <button
                  onClick={() => {
                    const topicId = (note as any).topicId || (note as any).topic || '';
                    const params = new URLSearchParams();
                    if (topicId) params.set('topicId', topicId);
                    // Prefer standalone practice page for full practice experience
                    window.location.assign(`/tests?${params.toString()}`);
                  }}
                  className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium rounded-md"
                  aria-label={`Practice for ${note.title}`}
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
