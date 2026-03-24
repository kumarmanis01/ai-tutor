'use client';

/**
 * ProfileCompletionGate -- inline multi-step form (V2)
 *
 * Shows as a bottom-sheet modal when board/grade/language/subjects are missing.
 * Four steps: Language -> Board -> Class -> Subjects.
 * No Name or Age fields -- those are collected separately.
 *
 * Accepts initialValues from the layout (server-side profile data) so that
 * already-filled fields are pre-populated and the form opens at the first
 * missing step rather than always at step 0.
 *
 * On submit: POSTs to /api/user/onboarding, then calls router.refresh().
 * router.refresh() forces the server layout to re-query the DB. Once
 * isProfileComplete() returns true, showProfileGate becomes false and
 * this component unmounts.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';

interface ProfileInitialValues {
  board: string | null;
  grade: string | null;
  language: string | null;
  subjects: string[];
}

interface ProfileCompletionGateProps {
  initialValues?: ProfileInitialValues;
}

const STEP_LABELS = ['Language', 'Board', 'Class', 'Subjects'] as const;

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', desc: 'English medium' },
  { code: 'hi', label: 'Hindi', desc: 'Hindi medium' },
  { code: 'regional', label: 'Regional', desc: 'State / regional language' },
] as const;

const BOARD_OPTIONS = [
  { slug: 'cbse', label: 'CBSE', desc: 'Central Board of Secondary Education' },
  { slug: 'icse', label: 'ICSE', desc: 'Indian Certificate of Secondary Education' },
  { slug: 'state', label: 'State Board', desc: 'State / regional board' },
] as const;

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function parseGrade(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 0;
}

function getInitialStep(iv: ProfileInitialValues | undefined): number {
  if (!iv?.language) return 0;
  if (!iv?.board) return 1;
  if (!iv?.grade) return 2;
  if (!iv?.subjects?.length) return 3;
  return 0; // all fields present -- gate should not be showing; default to 0
}

function stepCanAdvance(
  step: number,
  language: string,
  board: string,
  grade: number,
  subjects: string[],
): boolean {
  if (step === 0) return language !== '';
  if (step === 1) return board !== '';
  if (step === 2) return grade > 0;
  if (step === 3) return subjects.length > 0;
  return false;
}

function Tick() {
  return (
    <span className="w-5 h-5 rounded-full bg-[#534AB7] flex items-center justify-center shrink-0">
      <span className="text-white text-[10px] font-bold leading-none">✓</span>
    </span>
  );
}

function OptionRow({
  selected,
  label,
  desc,
  onClick,
}: {
  selected: boolean;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-3 w-full min-h-[52px] px-4 py-3 rounded-xl border-2 text-left transition-all',
        selected
          ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/15'
          : 'border-gray-200 dark:border-gray-700 hover:border-[#534AB7]/40',
      ].join(' ')}
    >
      <span className="flex-1">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{desc}</span>
      </span>
      {selected && <Tick />}
    </button>
  );
}

export default function ProfileCompletionGate({
  initialValues,
}: ProfileCompletionGateProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Pre-populate from server-side profile data; open at first missing step
  const [step, setStep] = useState(() => getInitialStep(initialValues));
  const [language, setLanguage] = useState(initialValues?.language ?? 'en');
  const [board, setBoard] = useState(initialValues?.board ?? '');
  const [grade, setGrade] = useState(() => parseGrade(initialValues?.grade));
  const [subjects, setSubjects] = useState<string[]>(initialValues?.subjects ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();

  useEffect(() => { setMounted(true); }, []);

  const availableSubjects = helpers.getSubjectsForGrade(board || null, grade || null);
  const isLastStep = step === STEP_LABELS.length - 1;
  const canProceed = stepCanAdvance(step, language, board, grade, subjects);

  function toggleSubject(slug: string) {
    setSubjects((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function handleSubmit() {
    if (subjects.length === 0 || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_language: language,
          board,
          class_grade: grade,
          subjects,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError((json?.error as string | undefined) ?? "Couldn't save -- tap to retry.");
        return;
      }
      // Force server layout re-render: isProfileComplete() -> true -> gate unmounts
      router.refresh();
    } catch {
      setSaveError("Network error -- check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (!canProceed || saving) return;
    if (isLastStep) {
      void handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  if (!mounted) return null;

  const gate = (
    <div
      className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Complete your profile"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#EEEDFE] dark:bg-[#534AB7]/20 flex items-center justify-center text-xl shrink-0">
            📚
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Complete your profile
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Help Vidya personalise your learning
            </p>
          </div>
        </div>

        {/* Step progress bar */}
        <div className="flex gap-1 mb-5">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-[#534AB7]' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        <p className="text-xs font-semibold text-[#534AB7] uppercase tracking-wide mb-4">
          Step {step + 1} of {STEP_LABELS.length} -- {STEP_LABELS[step]}
        </p>

        {/* ── Step 0: Language ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col gap-3">
            {LANGUAGE_OPTIONS.map(({ code, label, desc }) => (
              <OptionRow
                key={code}
                selected={language === code}
                label={label}
                desc={desc}
                onClick={() => setLanguage(code)}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Board ────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            {BOARD_OPTIONS.map(({ slug, label, desc }) => (
              <OptionRow
                key={slug}
                selected={board === slug}
                label={label}
                desc={desc}
                onClick={() => { setBoard(slug); setSubjects([]); }}
              />
            ))}
          </div>
        )}

        {/* ── Step 2: Grade ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => { setGrade(g); setSubjects([]); }}
                className={[
                  'min-h-[44px] rounded-xl border-2 text-sm font-bold transition-all',
                  grade === g
                    ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/40',
                ].join(' ')}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* ── Step 3: Subjects ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            {hierarchyLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[44px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : availableSubjects.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No subjects found -- please go back and check your board and class.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                {availableSubjects.map((s) => {
                  const checked = subjects.includes(s.slug);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleSubject(s.slug)}
                      className={[
                        'flex items-center gap-3 w-full min-h-[44px] px-4 py-2.5 rounded-xl border-2 text-left transition-all',
                        checked
                          ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/15'
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#534AB7]/40',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                          checked
                            ? 'border-[#534AB7] bg-[#534AB7]'
                            : 'border-gray-300 dark:border-gray-600',
                        ].join(' ')}
                      >
                        {checked && (
                          <span className="text-white text-[9px] font-bold leading-none">✓</span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {s.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Select at least 1 subject
            </p>
          </div>
        )}

        {saveError && (
          <p role="alert" className="mt-3 text-xs text-[#E24B4A] dark:text-red-400">
            {saveError}
          </p>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || saving}
          className="mt-5 flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4239a3] active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : isLastStep ? 'Start learning →' : 'Continue →'}
        </button>
      </div>
    </div>
  );

  // Render via portal so the overlay sits outside any scroll-container ancestor.
  return createPortal(gate, document.body);
}
