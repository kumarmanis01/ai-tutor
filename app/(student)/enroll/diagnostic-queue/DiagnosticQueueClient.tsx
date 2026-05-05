'use client';

/**
 * FILE OBJECTIVE:
 * - Brief animated screen shown between enrollment and the first diagnostic.
 * - Auto-redirects to /diagnostic/[subjectId]?from=enrollment after 1.5s.
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for post-enrollment diagnostic flow
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  nextSubjectId: string;
  nextSubjectName: string;
  totalSubjects: number;
  completedCount: number;
}

export default function DiagnosticQueueClient({
  nextSubjectId,
  nextSubjectName,
  totalSubjects,
  completedCount,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push(`/diagnostic/${nextSubjectId}?from=enrollment`);
    }, 1500);
    return () => clearTimeout(t);
  }, [nextSubjectId, router]);

  const remaining = totalSubjects - completedCount;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">
        {/* Animated icon */}
        <div className="w-20 h-20 rounded-3xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 flex items-center justify-center mx-auto mb-6">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#534AB7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-10"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
            aria-hidden
          >
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {completedCount === 0 ? "Let's find out what you know" : 'Great progress!'}
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Starting diagnostic for
        </p>
        <p className="text-lg font-semibold text-[#534AB7] dark:text-[#9d97e3] mb-4">
          {nextSubjectName}
        </p>

        {totalSubjects > 1 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {remaining} subject{remaining === 1 ? '' : 's'} remaining
          </p>
        )}

        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center mt-6">
          {Array(totalSubjects).fill(null).map((_, i) => (
            <div
              key={i}
              className={[
                'w-2 h-2 rounded-full transition-colors',
                i < completedCount
                  ? 'bg-[#1D9E75]'
                  : i === completedCount
                  ? 'bg-[#534AB7]'
                  : 'bg-gray-200 dark:bg-slate-700',
              ].join(' ')}
            />
          ))}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(0.95); }
          }
        `}</style>
      </div>
    </div>
  );
}
