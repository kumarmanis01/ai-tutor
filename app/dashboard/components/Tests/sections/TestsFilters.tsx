import React from 'react';

export function TestsFilters() {
  return (
    <div className="flex items-center gap-2">
      <select className="px-3 py-2 border rounded">
        <option>All Subjects</option>
        <option>Mathematics</option>
        <option>Science</option>
        <option>English</option>
      </select>
      <select className="px-3 py-2 border rounded">
        <option>All Levels</option>
        <option>Easy</option>
        <option>Medium</option>
        <option>Hard</option>
      </select>
    </div>
  );
}
