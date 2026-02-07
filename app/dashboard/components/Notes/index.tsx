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
import { NotesDownload } from './sections/NotesDownload';
import { NotesBySubject } from './sections/NotesBySubject';
import { NotesBookmarked } from './sections/NotesBookmarked';
import { NotesDownloaded } from './sections/NotesDownloaded';
import { NotesRecentlyAdded } from './sections/NotesRecentlyAdded';
import { NotesProvider } from './context/NotesProvider';

function NotesContent() {
  // Auto-refresh is handled by NotesProvider when profile loads
  return (
    <div className="space-y-6 px-3 sm:px-4 py-4">
      <NotesHeader />
      <NotesSearch />
      <NotesDownload />
      <NotesBySubject />
      <NotesBookmarked />
      <NotesDownloaded />
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
