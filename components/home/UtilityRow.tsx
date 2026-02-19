import React from 'react';

export interface UtilityRowProps {
  unresolvedCount?: number;
}

export default function UtilityRow({ unresolvedCount = 0 }: UtilityRowProps) {
  return (
    <nav
      className="bg-white rounded-lg shadow p-3"
      aria-label="Utility links"
    >
      <ul className="flex items-center gap-4" role="list">
        <li>
          <a
            href="/dashboard/doubts"
            className="inline-flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label={`Doubts${unresolvedCount > 0 ? `, ${unresolvedCount} unresolved` : ''}`}
          >
            <span className="text-sm text-gray-700">Doubts</span>
            {unresolvedCount > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-100 text-xs font-semibold text-red-700">
                {unresolvedCount}
              </span>
            ) : null}
          </a>
        </li>

        <li>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Curriculum"
          >
            <span className="text-sm text-gray-700">Curriculum</span>
          </a>
        </li>

        <li>
          <a
            href="#"
            className="inline-flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="History"
          >
            <span className="text-sm text-gray-700">History</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
