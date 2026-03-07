/**
 * HomeworkPendingCard
 *
 * Dashboard card showing pending and overdue homework assignments.
 * Returns null (renders nothing) when there are no pending items.
 *
 * Design rules (UX architecture review):
 *   - Hidden entirely when empty — no "no homework" placeholder
 *   - Shows max 3 items (homepage summary; full list in profile)
 *   - Amber tone for due, red for overdue
 *   - Plain due date language (no timestamps)
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created; replaces HomeworkCard on
 *               dashboard (tighter empty-state and 3-item cap)
 */
import React from 'react';
import Link from 'next/link';

export interface HomeworkPendingItem {
  id: string;
  topicName: string;
  status: 'PENDING' | 'OVERDUE';
  dueDate: string; // ISO string
  questionCount: number;
}

export interface HomeworkPendingCardProps {
  items: HomeworkPendingItem[];
}

function dueDateLabel(dueDateIso: string, status: 'PENDING' | 'OVERDUE'): string {
  if (status === 'OVERDUE') return 'Overdue';
  const due = new Date(dueDateIso);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
}

export default function HomeworkPendingCard({ items }: HomeworkPendingCardProps) {
  // Hidden entirely when no pending homework — never show empty state
  if (items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"
      aria-labelledby="homework-pending-heading"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 id="homework-pending-heading" className="text-sm font-semibold text-gray-700">
          Homework Due
        </h3>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
          {items.length}
        </span>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const isOverdue = item.status === 'OVERDUE';
          const label = dueDateLabel(item.dueDate, item.status);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.topicName}</p>
                <p className="text-xs mt-0.5 text-gray-400">
                  {item.questionCount} question{item.questionCount !== 1 ? 's' : ''} &nbsp;·&nbsp;
                  <span className={isOverdue ? 'text-red-500 font-medium' : 'text-amber-600'}>
                    {label}
                  </span>
                </p>
              </div>
              <Link
                href={`/homework/${item.id}`}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Submit
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
