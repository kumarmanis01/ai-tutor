import React from 'react';
import { NotesSection } from './NotesSection';
import { useNotes } from '../context/NotesProvider';

export function NotesDownloaded() {
  const { downloaded, loading } = useNotes();
  return (
    <NotesSection title="Downloaded (Offline)">
      {loading && downloaded.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {downloaded.map((n) => (
            <button key={n.id} className="w-full px-3 py-2 border rounded text-left">
              {n.title}
            </button>
          ))}
        </div>
      )}
    </NotesSection>
  );
}
