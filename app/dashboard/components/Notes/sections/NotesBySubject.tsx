import React from 'react';
import { NotesSection } from './NotesSection';
import { useNotes } from '../context/NotesProvider';

export function NotesBySubject() {
  const { subjects } = useNotes();
  return (
    <NotesSection title="By Subject">
      <div className="space-y-2">
        {subjects.map((s) => (
          <button key={s.name} className="w-full flex items-center justify-between px-3 py-2 border rounded">
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">{s.meta}</span>
          </button>
        ))}
      </div>
    </NotesSection>
  );
}
