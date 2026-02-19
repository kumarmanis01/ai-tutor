import React from 'react';

export type Assignment = {
  id: string | number;
  title: string;
  dueAt?: string | null;
  topicId?: string | number;
  quickAction?: string | null; // Label for action button (e.g., 'Review', 'Submit')
};

export interface AssignmentsRowProps {
  assignments: Assignment[];
}

export default function AssignmentsRow({ assignments }: AssignmentsRowProps) {
  return (
    <section className="bg-white rounded-lg shadow p-4" aria-labelledby="assignments-row-heading">
      <div className="flex items-center justify-between">
        <h3 id="assignments-row-heading" className="text-lg font-semibold">
          Assignments
        </h3>
      </div>

      <ul role="list" className="mt-3 divide-y">
        {assignments && assignments.length > 0 ? (
          assignments.map((a) => (
            <li key={a.id} className="py-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-xs text-gray-500">
                  {a.dueAt ? new Date(a.dueAt).toLocaleString() : 'No due date'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm bg-indigo-600 text-white px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  aria-label={`${a.quickAction ?? 'Review'} ${a.title}`}
                >
                  {a.quickAction ?? 'Review'}
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="py-2 text-sm text-gray-500">No assignments</li>
        )}
      </ul>
    </section>
  );
}
