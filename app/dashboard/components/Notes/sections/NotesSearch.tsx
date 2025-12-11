import React from 'react';
import { useNotes } from '../context/NotesProvider';

export function NotesSearch() {
  const { query, setQuery } = useNotes();
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Search notes..."
        className="flex-1 px-3 py-2 border rounded"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}
