'use client';

/**
 * ProfileSetupForm — v2 (Screen 3)
 *
 * 4-step forward-only wizard to capture the student's academic profile.
 * No back button, no close.
 *
 * Steps:
 *   1. Board    — card grid: CBSE | ICSE | State Board
 *   2. Class    — number grid 6–12, selected = purple border
 *   3. Medium   — two large tap targets: English | Hindi
 *   4. Subjects — checkbox grid, locked core subjects, max 6
 *
 * On final step submit: calls onSave(values) — caller posts to /api/user/onboarding.
 *
 * Progress bar shows N of 4 complete.
 * Sidebar checklist tracks which steps are done.
 */

import React, { useEffect, useState } from 'react';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileValues {
  board: string;
  grade: number;
  language: 'en' | 'hi';
  subjects: string[];
  age?: number;
  name?: string;
}

export interface ProfileSetupFormProps {
  /** Pre-filled age from registration (stored in URL param). */
  initialAge?: number;
  /** True when grade+board were already saved (immutable). */
  gradeLocked?: boolean;
  /** True while the parent call to /api/user/onboarding is in flight. */
  saving?: boolean;
  /** Error from the parent save operation. */
  saveError?: string;
  onSave: (values: ProfileValues) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADES = [6, 7, 8, 9, 10, 11, 12];

const BOARD_OPTIONS = [
  { slug: 'cbse', label: 'CBSE', desc: 'Central Board of Secondary Education' },
  { slug: 'icse', label: 'ICSE', desc: 'Indian Certificate of Secondary Education' },
  { slug: 'state', label: 'State Board', desc: 'State / Regional board' },
];

/** Subjects that cannot be deselected for a given board+grade combo. */
function getMandatorySubjects(board: string, grade: number): string[] {
  const g = grade;
  if (board === 'cbse') {
    if (g >= 9 && g <= 10) return ['mathematics', 'math', 'science', 'english'];
    if (g >= 11) return ['english'];
  }
  return [];
}

/** Steps label + key */
const STEPS = ['Board', 'Class', 'Medium', 'Subjects'] as const;
type StepKey = typeof STEPS[number];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileSetupForm({
  initialAge,
  gradeLocked = false,
  saving = false,
  saveError,
  onSave,
}: ProfileSetupFormProps) {
  const [step, setStep] = useState(0); // 0–3
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState(0);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectError, setSubjectError] = useState('');

  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();

  // Derive subjects list from hierarchy (falls back to empty if not loaded yet)
  const availableSubjects = grade
    ? helpers.getSubjectsForGrade(board, grade)
    : [];

  // Auto-select mandatory subjects whenever board/grade changes
  useEffect(() => {
    if (!board || !grade) return;
    const mandatory = getMandatorySubjects(board, grade);
    if (mandatory.length === 0) return;

    setSubjects((prev) => {
      const merged = [...new Set([...mandatory, ...prev])];
      return merged.slice(0, 6);
    });
  }, [board, grade]);

  // Reset subjects when board or grade changes
  const [prevBoard, setPrevBoard] = useState('');
  const [prevGrade, setPrevGrade] = useState(0);
  useEffect(() => {
    if (prevBoard && prevBoard !== board) {
      setSubjects([]);
    }
    setPrevBoard(board);
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevGrade && prevGrade !== grade) {
      setSubjects([]);
    }
    setPrevGrade(grade);
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const completedSteps: boolean[] = [
    !!board,
    !!grade,
    !!language,
    subjects.length > 0,
  ];

  const progress = completedSteps.filter(Boolean).length;

  function toggleSubject(slug: string, mandatory: boolean) {
    if (mandatory) return; // cannot deselect mandatory
    setSubjectError('');
    setSubjects((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 6) {
        setSubjectError('Maximum 6 subjects allowed.');
        return prev;
      }
      return [...prev, slug];
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return !!board;
    if (step === 1) return !!grade;
    if (step === 2) return !!language;
    if (step === 3) return subjects.length > 0;
    return false;
  }

  function handleContinue() {
    if (!canAdvance()) return;
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      onSave({ board, grade, language, subjects, age: initialAge });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const mandatory = getMandatorySubjects(board, grade);
  const mandatoryNotes =
    board === 'cbse' && grade >= 9 && grade <= 10
      ? 'Maths & Science are mandatory for CBSE Grade ' + grade + '.'
      : null;

  return (
    <div className="w-full max-w-lg mx-auto">

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {progress} of 4 complete
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Step {step + 1} of 4
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#534AB7] transition-all duration-500"
            style={{ width: `${((step + (canAdvance() ? 1 : 0)) / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4">

        {/* Sidebar checklist */}
        <aside className="hidden sm:flex flex-col gap-2 pt-1 flex-shrink-0 w-28">
          {STEPS.map((label, i) => {
            const done = completedSteps[i];
            const active = i === step;
            return (
              <div
                key={label}
                className={`flex items-center gap-2 text-xs font-medium ${
                  active
                    ? 'text-[#534AB7] dark:text-indigo-300'
                    : done
                    ? 'text-[#1D9E75] dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                    done
                      ? 'bg-[#1D9E75] text-white'
                      : active
                      ? 'border-2 border-[#534AB7] text-[#534AB7]'
                      : 'border-2 border-gray-300 dark:border-slate-600 text-gray-400'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                {label}
              </div>
            );
          })}
        </aside>

        {/* Step content */}
        <div className="flex-1 min-w-0">

          {/* ── Step 1: Board ────────────────────────────────────────── */}
          {step === 0 && (
            <section aria-labelledby="step-board">
              <h2 id="step-board" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Which board do you study under?
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {BOARD_OPTIONS.map((b) => (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => { setBoard(b.slug); }}
                    className={[
                      'flex items-start gap-4 rounded-xl border-2 px-4 py-4 min-h-[44px] text-left transition-all',
                      board === b.slug
                        ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 hover:border-[#534AB7]/40',
                    ].join(' ')}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        board === b.slug ? 'border-[#534AB7] bg-[#534AB7]' : 'border-gray-300 dark:border-slate-500'
                      }`}
                    >
                      {board === b.slug && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{b.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Step 2: Class ────────────────────────────────────────── */}
          {step === 1 && (
            <section aria-labelledby="step-class">
              <h2 id="step-class" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                Which class are you in?
              </h2>
              {board && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{BOARD_OPTIONS.find(b => b.slug === board)?.label}</p>
              )}
              {gradeLocked && grade ? (
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 mb-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Class {grade}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Class is locked — contact support to change it.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={[
                        'min-h-[52px] rounded-xl border-2 text-sm font-bold transition-all',
                        grade === g
                          ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/40',
                      ].join(' ')}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Step 3: Medium ───────────────────────────────────────── */}
          {step === 2 && (
            <section aria-labelledby="step-medium">
              <h2 id="step-medium" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Which language do you prefer?
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { code: 'en', label: 'English', sublabel: 'English medium' },
                  { code: 'hi', label: 'हिंदी', sublabel: 'Hindi medium' },
                ] as const).map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={[
                      'flex flex-col items-center justify-center gap-1 rounded-2xl border-2 min-h-[88px] px-4 py-5 transition-all',
                      language === lang.code
                        ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 hover:border-[#534AB7]/40',
                    ].join(' ')}
                  >
                    <span className="text-2xl font-bold">{lang.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{lang.sublabel}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Step 4: Subjects ─────────────────────────────────────── */}
          {step === 3 && (
            <section aria-labelledby="step-subjects">
              <h2 id="step-subjects" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                Which subjects?
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Select up to 6. Tap a subject to add or remove it.
              </p>

              {mandatoryNotes && (
                <div className="mb-3 rounded-lg bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-3 py-2">
                  <p className="text-xs text-[#534AB7] dark:text-indigo-300 font-medium">{mandatoryNotes}</p>
                </div>
              )}

              {hierarchyLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-11 rounded-xl bg-gray-100 dark:bg-slate-700 animate-pulse" />
                  ))}
                </div>
              ) : availableSubjects.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No subjects found for {board} Class {grade}. You can add subjects later.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableSubjects.map((subj) => {
                    const isMandatory = mandatory.some(
                      (m) => m === subj.slug.toLowerCase() || subj.slug.toLowerCase().startsWith(m)
                    );
                    const selected = subjects.includes(subj.slug);
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => toggleSubject(subj.slug, isMandatory)}
                        className={[
                          'flex items-center gap-2 min-h-[44px] rounded-xl border-2 px-3 text-sm font-medium text-left transition-all',
                          selected
                            ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/40',
                          isMandatory ? 'opacity-80' : '',
                        ].join(' ')}
                        aria-pressed={selected}
                        title={isMandatory ? 'Mandatory — cannot be removed' : undefined}
                      >
                        <span
                          className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center text-[10px] font-bold ${
                            selected
                              ? 'bg-[#534AB7] border-[#534AB7] text-white'
                              : 'border-gray-300 dark:border-slate-500'
                          }`}
                        >
                          {selected && '✓'}
                        </span>
                        <span className="truncate">{subj.name}</span>
                        {isMandatory && (
                          <span className="ml-auto text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0">Required</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {subjectError && (
                <p role="alert" className="mt-2 text-xs text-[#E24B4A] dark:text-red-400">{subjectError}</p>
              )}
            </section>
          )}

          {/* ── Continue / Save ──────────────────────────────────────── */}
          <div className="mt-6">
            {saveError && (
              <p role="alert" className="mb-3 text-xs text-[#E24B4A] dark:text-red-400">{saveError}</p>
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canAdvance() || saving}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-[#534AB7]/25"
            >
              {saving
                ? 'Saving…'
                : step < 3
                ? 'Continue →'
                : 'Save & continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
