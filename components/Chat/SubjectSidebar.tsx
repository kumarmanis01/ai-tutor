'use client';

import React from 'react';

export default function SubjectSidebar({
  subject,
  setSubject,
  compact = false,
  onSelect,
}: {
  subject: string;
  setSubject: (s: string) => void;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const subjects = ['general', 'math', 'science', 'coding'];

  // On small screens hide the sidebar and show via parent hamburger/drawer.
  // When `compact` is true, keep it hidden regardless of viewport.
  // If `onSelect` is provided (drawer mode), always show so the parent drawer
  // can render the sidebar content on small screens.
  const asideClass = compact
    ? 'w-44 pr-4 hidden'
    : onSelect
    ? 'w-64 pr-4 block'
    : 'w-44 pr-4 hidden md:block';

  return (
    <aside className={asideClass} aria-label="Subjects">
      <div className="flex flex-col gap-2 sticky top-4">
        {subjects.map((s) => (
          <button
            key={s}
            onClick={() => {
              setSubject(s);
              try {
                onSelect?.();
              } catch {}
            }}
            className={`text-left px-3 py-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
              subject === s
                ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold ring-1 ring-blue-200 dark:ring-blue-800'
                : 'text-gray-700 dark:text-gray-300'
            }`}
            aria-pressed={subject === s}
          >
            {s === 'general' ? 'General' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </aside>
  );
}
