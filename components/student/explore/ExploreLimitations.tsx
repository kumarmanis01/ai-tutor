'use client';

/**
 * FILE OBJECTIVE:
 * - Render a student-facing feature availability list that clearly distinguishes currently available explore features from features locked until parent approval.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/ExploreLimitations.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created file header to align with ENGINEERING_PRACTICES.md §8 template
 */

interface Feature {
  label: string;
  available: boolean;
  lockedCopy?: string;
}

const FEATURES: Feature[] = [
  { label: 'Sample Lessons (3 topics)', available: true },
  { label: 'Diagnostic Quiz', available: true },
  {
    label: 'AI Tutor (Teacher Vidya)',
    available: false,
    lockedCopy: 'Ask Mom to approve to chat with Teacher Vidya!',
  },
  {
    label: 'Practice Questions',
    available: false,
    lockedCopy: 'Practice unlocks with parent approval. Explore sample lessons now!',
  },
  {
    label: 'Topic Generation',
    available: false,
    lockedCopy: 'Requesting new topics unlocks with parent approval.',
  },
  {
    label: 'Progress Tracking',
    available: false,
    lockedCopy: 'Your progress will be saved after parent approval.',
  },
  {
    label: 'Streaks & XP',
    available: false,
    lockedCopy: 'Streaks and rewards begin after approval!',
  },
];

export default function ExploreLimitations() {
  return (
    <div className="px-4 mt-8">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
        What's available now
      </h3>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
        {FEATURES.map((f) => (
          <div
            key={f.label}
            className="flex items-start gap-3 px-4 py-3 min-h-[52px]"
          >
            <span
              className={`mt-0.5 shrink-0 text-base ${f.available ? 'text-[#1D9E75]' : 'text-gray-300 dark:text-gray-600'}`}
              aria-hidden
            >
              {f.available ? '✅' : '❌'}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm ${f.available ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}`}
              >
                {f.label}
              </p>
              {!f.available && f.lockedCopy && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
                  {f.lockedCopy}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
