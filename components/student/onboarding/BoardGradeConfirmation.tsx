'use client';

/**
 * FILE OBJECTIVE:
 * - Render the student onboarding board and grade confirmation step with prefilled registration values and a confirmation flow.
 * - Support confirmation or update of board/grade selections before continuing, including explore-diagnostic skip behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/onboarding/BoardGradeConfirmation.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created file header in required template for new component
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Board data ────────────────────────────────────────────────────────────────

interface BoardOption {
  value: string;
  label: string;
  shortLabel: string;
  emoji: string;
}

const BOARDS: BoardOption[] = [
  { value: 'CBSE', label: 'CBSE', shortLabel: 'CBSE', emoji: '🇮🇳' },
  { value: 'ICSE', label: 'ICSE', shortLabel: 'ICSE', emoji: '📚' },
  { value: 'STATE_MAHARASHTRA', label: 'Maharashtra Board', shortLabel: 'MH Board', emoji: '🟧' },
  { value: 'STATE_UTTAR_PRADESH', label: 'Uttar Pradesh Board', shortLabel: 'UP Board', emoji: '🟦' },
  { value: 'STATE_OTHER', label: 'Other State Board', shortLabel: 'State Board', emoji: '📋' },
];

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialBoard: string;
  initialGrade: number;
  studentId: string;
  /** If the student completed the S1.3 diagnostic during Explore Mode, skip confirmation. */
  hasCompletedExploreDiagnostic?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function boardLabel(value: string): string {
  return BOARDS.find((b) => b.value === value)?.label ?? value;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BoardGradeConfirmation({
  initialBoard,
  initialGrade,
  studentId,
  hasCompletedExploreDiagnostic = false,
}: Props) {
  const router = useRouter();

  const [board, setBoard] = useState(initialBoard);
  const [grade, setGrade] = useState(initialGrade);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // If the student completed the diagnostic in explore mode, skip to Learning Map immediately.
  // Side-effect must be in useEffect to avoid calling router during render (hydration loop).
  useEffect(() => {
    if (hasCompletedExploreDiagnostic) {
      router.replace('/student/learning-map');
    }
  }, [hasCompletedExploreDiagnostic, router]);

  if (hasCompletedExploreDiagnostic) return null;

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      // Patch only if something changed vs. what came from the server.
      if (board !== initialBoard || grade !== initialGrade) {
        const res = await fetch(`/api/v1/students/${encodeURIComponent(studentId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          // grade/board immutable after first save -- strip from all PATCH handlers
          body: JSON.stringify({ board, grade }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setError(json.error ?? 'Could not save changes. Please try again.');
          return;
        }
      }
      router.push('/student/onboarding/diagnostic');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  const activeBoard = BOARDS.find((b) => b.value === board);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#534AB7]/30">
            <span className="text-white font-bold text-lg leading-none">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Confirm your details
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            We pre-filled this from your registration. Does this look right?
          </p>
        </div>

        {!editing ? (
          /* ── Summary view (default) ──────────────────────────────────────── */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Board</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {activeBoard?.emoji} {activeBoard?.label ?? board}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Grade</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Grade {grade}
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => { void handleConfirm(); }}
              disabled={busy}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
            >
              {busy ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Saving...
                </>
              ) : (
                'This is Correct! →'
              )}
            </button>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          /* ── Edit view ────────────────────────────────────────────────────── */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm space-y-5">

            {/* Board carousel */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Select your board
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                {BOARDS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBoard(b.value)}
                    className={[
                      'snap-start shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border-2 px-4 py-3 min-h-[72px] min-w-[88px] transition-all',
                      board === b.value
                        ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#534AB7]/40',
                    ].join(' ')}
                    aria-pressed={board === b.value}
                  >
                    <span className="text-2xl" aria-hidden>{b.emoji}</span>
                    <span
                      className={`text-xs font-semibold text-center leading-tight ${
                        board === b.value
                          ? 'text-[#534AB7] dark:text-indigo-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {b.shortLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grade grid */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Select your grade
              </p>
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={[
                      'flex items-center justify-center min-h-[52px] rounded-xl border-2 text-base font-bold transition-all',
                      grade === g
                        ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/40',
                    ].join(' ')}
                    aria-pressed={grade === g}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => { void handleConfirm(); }}
              disabled={busy || !board || !grade}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
            >
              {busy ? 'Saving...' : `Confirm -- ${boardLabel(board)}, Grade ${grade} →`}
            </button>

            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Board and grade are set once. Contact support if you need to change them later.
        </p>
      </div>
    </div>
  );
}
