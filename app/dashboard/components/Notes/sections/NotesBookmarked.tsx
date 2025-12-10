import React from 'react';
import { NotesSection } from './NotesSection';
import { useNotes } from '../context/NotesProvider';

export function NotesBookmarked() {
  const { bookmarked } = useNotes();
  return (
    <NotesSection title="Bookmarked Notes">
      <div className="space-y-2">
        {bookmarked.map((n) => (
          <button key={n.id} className="w-full px-3 py-2 border rounded text-left">
            {n.title}
          </button>
        ))}
      </div>
    </NotesSection>
  );
}
