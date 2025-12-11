import React from 'react';
import { NotesSection } from './NotesSection';
import { useNotes } from '../context/NotesProvider';

export function NotesRecentlyAdded() {
  const { recent, loading } = useNotes();
  return (
    <NotesSection title="Recently Added">
      {loading && recent.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {recent.map((n) => (
            <div key={n.id} className="text-sm text-muted-foreground">{n.title}</div>
          ))}
        </div>
      )}
    </NotesSection>
  );
}
