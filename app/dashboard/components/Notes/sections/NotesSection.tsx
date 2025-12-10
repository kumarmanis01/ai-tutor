import React from 'react';

export function NotesSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
