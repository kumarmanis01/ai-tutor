'use client';
/**
 * FILE OBJECTIVE:
 * - Notes tab container that composes all Notes sections.
 * - Uses NotesProvider for state management with auto-refresh on profile load.
 * - NotesSearch provides Subject → Chapter → Topic filtering with profile defaults.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Notes/index.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | removed manual refresh call (provider auto-refreshes on profile load)
 * - 2026-02-03 | claude | added NotesFiltered section with cascading dropdowns
 * - 2026-02-03 | claude | removed NotesFiltered (redundant), NotesSearch now has chapter dropdown
 */

import React from 'react';
import { NotesHeader } from './sections/NotesHeader';
import { NotesSearch } from './sections/NotesSearch';
import { NotesRecentlyAdded } from './sections/NotesRecentlyAdded';
import { NotesProvider } from './context/NotesProvider';

function NotesContent() {
  // Removed: NotesBySubject (accordion), NotesBookmarked/NotesDownloaded (empty sections),
  // NotesDownload (empty section). Replaced by ContinueLearning + Browse + Recent on /dashboard/notes.
  return (
    <div className="space-y-6 px-3 sm:px-4 py-4">
      <NotesHeader />
      <NotesSearch />
      <NotesRecentlyAdded />
    </div>
  );
}

export default function NotesTab() {
  return (
    <NotesProvider>
      <NotesContent />
    </NotesProvider>
  );
}
