import React from 'react';

export function TestsCTAs() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <button className="px-3 py-2 border rounded text-left">Start a New Test</button>
      <button className="px-3 py-2 border rounded text-left">Resume Last Test</button>
      <button className="px-3 py-2 border rounded text-left">Share Practice Set</button>
    </div>
  );
}
