import React from 'react';
import { useTests } from '../context/TestsProvider';

export function TestsUpcoming() {
  const { upcoming, loading } = useTests();
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Upcoming</h2>
      {loading && upcoming.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((t) => (
            <div key={t.id} className="w-full px-3 py-2 border rounded text-left">
              {t.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
