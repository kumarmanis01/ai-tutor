'use client';

import React, { useEffect } from 'react';
import { NotesHeader } from './sections/NotesHeader';
import { NotesSearch } from './sections/NotesSearch';
import { NotesDownload } from './sections/NotesDownload';
import { NotesBySubject } from './sections/NotesBySubject';
import { NotesBookmarked } from './sections/NotesBookmarked';
import { NotesDownloaded } from './sections/NotesDownloaded';
import { NotesRecentlyAdded } from './sections/NotesRecentlyAdded';
import { NotesProvider, useNotes } from './context/NotesProvider';

function NotesContent() {
  const { refresh } = useNotes();
  useEffect(() => { refresh(); }, [refresh]);
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
