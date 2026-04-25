/**
 * TopicStatusRow
 *
 * A single row in the learning path grid showing a topic's completion status.
 * Uses qualitative labels and icons -- never raw mastery percentages.
 *
 * Status icons:
 *   mastered / understood  → ✓ (green filled)
 *   in_progress            → ● (indigo)
 *   needs_practice         → ↺ (amber)
 *   upcoming               → ○ (gray)
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created for learning path page
 */
import React from 'react';
import Link from 'next/link';
import type { TopicStatus } from '@/lib/learning/masteryLabel';

export interface TopicStatusRowProps {
  topicId: string;
  topicName: string;
  status: TopicStatus;
  masteryLabel: string;
  sessionId?: string; // if in_progress -- links to resume
}

const STATUS_ICON: Record<TopicStatus, React.ReactNode> = {
  mastered: (
    <span className="text-green-600 font-bold text-base" aria-label="Mastered">
      ✓
    </span>
  ),
  understood: (
    <span className="text-green-500 font-bold text-base" aria-label="Understood">
      ✓
    </span>
  ),
  in_progress: (
    <span className="text-indigo-500 font-bold text-base" aria-label="In progress">
      ●
    </span>
  ),
  needs_practice: (
    <span className="text-amber-500 font-bold text-base" aria-label="Needs practice">
      ↺
    </span>
  ),
  getting_there: (
    <span className="text-blue-500 font-bold text-base" aria-label="Getting there">
      ◐
    </span>
  ),
  upcoming: (
    <span className="text-gray-300 font-bold text-base" aria-label="Upcoming">
      ○
    </span>
  ),
};

const STATUS_LABEL_COLOR: Record<TopicStatus, string> = {
  mastered: 'text-green-600',
  understood: 'text-green-500',
  in_progress: 'text-[#534AB7]',
  needs_practice: 'text-amber-600',
  getting_there: 'text-blue-500',
  upcoming: 'text-gray-400',
};

export default function TopicStatusRow({
  topicId,
  topicName,
  status,
  masteryLabel,
  sessionId: _sessionId,
}: TopicStatusRowProps) {
  const isActionable =
    status === 'in_progress' || status === 'needs_practice' || status === 'upcoming';
  const href = `/session/${topicId}`;

  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      {/* Status icon */}
      <span className="w-6 shrink-0 text-center">{STATUS_ICON[status]}</span>

      {/* Topic name */}
      <span className="flex-1 text-sm text-gray-800 truncate">{topicName}</span>

      {/* Mastery label */}
      <span className={`text-xs font-medium shrink-0 ${STATUS_LABEL_COLOR[status]}`}>
        {masteryLabel}
      </span>

      {/* Action link for actionable topics */}
      {isActionable && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-[#534AB7] hover:text-indigo-800 hover:underline ml-1"
        >
          {status === 'in_progress'
            ? 'Continue →'
            : status === 'needs_practice'
              ? 'Revise →'
              : 'Start →'}
        </Link>
      )}
    </li>
  );
}
