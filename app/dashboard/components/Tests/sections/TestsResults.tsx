import React from 'react';
import { useTests } from '../context/TestsProvider';

export function TestsResults() {
  const { results, loading } = useTests();
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Recent Results</h2>
      {loading && results.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.id} className="w-full px-3 py-2 border rounded text-left flex items-center justify-between">
              <span>{r.title}</span>
              <span className="text-xs text-muted-foreground">Score: {r.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
