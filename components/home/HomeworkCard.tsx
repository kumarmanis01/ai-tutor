/**
 * FILE OBJECTIVE:
 * - Dashboard widget showing pending and overdue homework assignments.
 * - Each row: topic name, due date label, and a Start button.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for homework dashboard card
 */
import React from 'react';
import Link from 'next/link';

export interface HomeworkItem {
  id: string;
  topicName: string;
  dueDate: string; // ISO string
  status: 'PENDING' | 'OVERDUE';
}

export interface HomeworkCardProps {
  items: HomeworkItem[];
}

function dueDateLabel(dueDateIso: string): string {
  const due = new Date(dueDateIso);
  const now = new Date();

  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due Today';
  if (diffDays === 1) return 'Due Tomorrow';
  return `Due in ${diffDays} days`;
}

export default function HomeworkCard({ items }: HomeworkCardProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="bg-white rounded-lg border p-6"
      aria-labelledby="homework-card-heading"
    >
      <h3 id="homework-card-heading" className="text-lg font-semibold text-gray-900 mb-4">
        Assignments
      </h3>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.topicName}</p>
              <p className={`text-xs mt-0.5 ${item.status === 'OVERDUE' ? 'text-red-500' : 'text-gray-400'}`}>
                {dueDateLabel(item.dueDate)}
              </p>
            </div>
            <Link
              href={`/session/homework/${item.id}`}
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Start
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
