import React from 'react';
import { useTests } from '../context/TestsProvider';

// Placeholder: if provider adds grouped-by-subject data later, wire here.
// For now, reuse recommended items and group by subject locally.
export function TestsBySubject() {
  const { items } = useTests();
  const groups = items.reduce<Record<string, string[]>>((acc, it) => {
    acc[it.subject] = acc[it.subject] || [];
    acc[it.subject].push(it.title);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">By Subject</h2>
      {Object.keys(groups).length === 0 ? (
        <div className="text-sm text-muted-foreground">No items</div>
      ) : (
        Object.entries(groups).map(([subject, titles]) => (
          <div key={subject} className="space-y-2">
            <div className="text-sm font-medium">{subject}</div>
            <div className="space-y-1">
              {titles.map((t) => (
                <button key={t} className="w-full px-3 py-2 border rounded text-left">{t}</button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
