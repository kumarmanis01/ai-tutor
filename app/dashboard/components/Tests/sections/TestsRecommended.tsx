import React from 'react';
import { useTests } from '../context/TestsProvider';

export function TestsRecommended() {
  const { items, loading } = useTests();
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Recommended</h2>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <button key={t.id} className="w-full px-3 py-2 border rounded text-left">
              {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
