'use client';

/**
 * FILE OBJECTIVE:
 * - Full-screen lesson viewer for Explore Mode sample topics (S0.3).
 *   Shows pre-generated note content (placeholder if no notes yet).
 *   "Mark as Complete" tracked in localStorage only -- not synced in explore mode.
 *   After viewing: prompts the student to unlock unlimited practice once parent approves.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/SampleLessonViewer.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | staff-engineer | created for S0.3 explore mode
 */

import { useState, useEffect } from 'react';

const LOCAL_COMPLETE_KEY = 'explore_completed_topics';

function getLocalCompleted(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_COMPLETE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveLocalCompleted(ids: Set<string>): void {
  try {
    localStorage.setItem(LOCAL_COMPLETE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors (private browsing etc.)
  }
}

interface Props {
  topicId: string;
  topicName: string;
  content: string | null;
  onClose: () => void;
  onSendReminder?: () => void;
}

export default function SampleLessonViewer({
  topicId,
  topicName,
  content,
  onClose,
  onSendReminder,
}: Props) {
  const [isComplete, setIsComplete] = useState(false);
  const [justMarked, setJustMarked] = useState(false);

  useEffect(() => {
    setIsComplete(getLocalCompleted().has(topicId));
  }, [topicId]);

  function handleMarkComplete() {
    const updated = getLocalCompleted();
    updated.add(topicId);
    saveLocalCompleted(updated);
    setIsComplete(true);
    setJustMarked(true);
  }

  return (
    <div className="fixed inset-0 z-[150] bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 min-h-[56px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to sample lessons"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{topicName}</p>
          <span className="text-xs bg-[#534AB7] text-white px-2 py-0.5 rounded-full">Free Preview</span>
        </div>
      </div>

      {/* Content body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-5 text-center">
            <p className="text-sm text-[#534AB7] dark:text-indigo-300 font-medium mb-1">
              Content is being prepared!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Teacher Vidya is creating notes for this topic. Check back in a few minutes.
            </p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 px-4 py-4 flex flex-col gap-3">
        {justMarked ? (
          <div className="rounded-xl bg-[#EAF3DE] dark:bg-[#1D9E75]/10 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-[#1D9E75]">
              Marked as complete! Great work.
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
              Your progress will be saved after parent approval.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={isComplete}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#178a64] disabled:opacity-50 transition-colors"
          >
            {isComplete ? 'Completed' : 'Mark as Complete'}
          </button>
        )}

        <div className="rounded-xl bg-[#FAEEDA] dark:bg-[#BA7517]/10 px-4 py-3">
          <p className="text-xs text-[#BA7517] dark:text-amber-300 font-medium mb-2">
            Want to practice this topic?
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            Unlock unlimited practice when your parent approves.
          </p>
          {onSendReminder && (
            <button
              type="button"
              onClick={onSendReminder}
              className="w-full min-h-[40px] rounded-lg bg-[#BA7517] text-white text-xs font-semibold hover:bg-[#a3670f] transition-colors"
            >
              Send Reminder to Mom
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
