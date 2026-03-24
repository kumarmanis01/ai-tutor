'use client';

/**
 * ProfileCompletionGate -- V2 inline multi-step form
 *
 * Shows as a centred modal when board/grade/language/subjects are missing.
 * Steps: Language -> Board -> Grade -> Subjects -> [Parent Email if age known].
 *
 * Visual style matches ProfileSetupForm exactly:
 *   - Same board cards (radio dot inside), grade grid (min-h-[52px]),
 *     language large cards, subject chips (2-column grid with mandatory lock).
 *   - Purple header with Vidya avatar.
 *
 * Accepts initialValues from the layout (server-side profile.data) so
 * already-filled fields are pre-populated and the form opens at the first
 * missing step.
 *
 * On submit: POSTs to /api/user/onboarding then calls router.refresh().
 * router.refresh() forces the server layout to re-query the DB; once
 * isProfileComplete() returns true, showProfileGate becomes false and
 * this component unmounts without a page reload.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface ProfileCompletionGateProps {
  // server-side profile data from checkProfileCompleteness(); used to
  // pre-populate the form and jump to the first missing step.
  initialValues?: StudentProfileData;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BOARD_OPTIONS = [
  { slug: 'cbse', label: 'CBSE', desc: 'Central Board of Secondary Education' },
  { slug: 'icse', label: 'ICSE', desc: 'Indian Certificate of Secondary Education' },
  { slug: 'state', label: 'State Board', desc: 'State / regional board' },
] as const;

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', sublabel: 'English medium' },
  { code: 'hi', label: 'हिंदी', sublabel: 'Hindi medium' },
] as const;

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// Mandatory subjects that cannot be deselected (mirrors ProfileSetupForm).
function getMandatorySubjects(board: string, grade: number): string[] {
  if (board === 'cbse') {
    if (grade >= 9 && grade <= 10) return ['mathematics', 'science', 'english'];
    if (grade >= 11) return ['english'];
  }
  return [];
}

// ── Step helpers ───────────────────────────────────────────────────────────────

// Steps in order. Parent email step is conditional: only when age is known.
type StepKey = 'language' | 'board' | 'grade' | 'subjects' | 'parentEmail';

function buildSteps(showParentEmail: boolean): StepKey[] {
  const steps: StepKey[] = ['language', 'board', 'grade', 'subjects'];
  if (showParentEmail) steps.push('parentEmail');
  return steps;
}

function parseGrade(raw: string | null | undefined): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 0;
}

function getInitialStep(
  iv: StudentProfileData | undefined,
  steps: StepKey[],
): number {
  if (!iv) return 0;
  const checks: Partial<Record<StepKey, boolean>> = {
    language: !iv.language,
    board: !iv.board,
    grade: !iv.grade,
    subjects: !Array.isArray(iv.subjects) || iv.subjects.length === 0,
    parentEmail: !iv.parentEmail,
  };
  for (let i = 0; i < steps.length; i++) {
    if (checks[steps[i]]) return i;
  }
  return 0; // all filled -- gate should not be showing; default to 0
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProfileCompletionGate({
  initialValues,
}: ProfileCompletionGateProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Whether to show the parent email step (age is known)
  const ageNum = initialValues?.age ?? null;
  const showParentEmail = ageNum !== null;
  const parentEmailRequired = ageNum !== null && ageNum < DPDP_MINOR_AGE;

  const steps = buildSteps(showParentEmail);

  // Pre-populate state from server-side profile data
  const [step, setStep] = useState(() => getInitialStep(initialValues, steps));
  const [language, setLanguage] = useState<'en' | 'hi'>(
    (initialValues?.language as 'en' | 'hi' | null) === 'hi' ? 'hi' : 'en',
  );
  const [board, setBoard] = useState(initialValues?.board ?? '');
  const [grade, setGrade] = useState(() => parseGrade(initialValues?.grade));
  const [subjects, setSubjects] = useState<string[]>(initialValues?.subjects ?? []);
  const [parentEmail, setParentEmail] = useState(initialValues?.parentEmail ?? '');
  const [parentEmailError, setParentEmailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();

  useEffect(() => { setMounted(true); }, []);

  // Auto-select mandatory subjects when board/grade change
  useEffect(() => {
    if (!board || !grade) return;
    const mandatory = getMandatorySubjects(board, grade);
    if (mandatory.length === 0) return;
    setSubjects((prev) => [...new Set([...mandatory, ...prev])].slice(0, 6));
  }, [board, grade]);

  const availableSubjects = helpers.getSubjectsForGrade(board || null, grade || null);
  const mandatory = getMandatorySubjects(board, grade);
  const currentStepKey = steps[step] as StepKey | undefined;
  const isLastStep = step === steps.length - 1;
  const totalSteps = steps.length;

  function canAdvance(): boolean {
    if (currentStepKey === 'language') return language !== '';
    if (currentStepKey === 'board') return board !== '';
    if (currentStepKey === 'grade') return grade > 0;
    if (currentStepKey === 'subjects') return subjects.length > 0;
    if (currentStepKey === 'parentEmail') {
      if (!parentEmailRequired) return true; // optional
      return parentEmail.trim().includes('@');
    }
    return false;
  }

  function toggleSubject(slug: string, isMandatory: boolean) {
    if (isMandatory) return;
    setSubjects((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 6) return prev;
      return [...prev, slug];
    });
  }

  async function handleSubmit() {
    if (saving) return;
    if (parentEmailRequired && !parentEmail.trim().includes('@')) {
      setParentEmailError('Enter a valid parent email address');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const payload: Record<string, unknown> = {
        preferred_language: language,
        board,
        class_grade: grade,
        subjects,
      };
      if (showParentEmail && parentEmail.trim()) {
        payload.parent_email = parentEmail.trim();
      }
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  function handleContinue() {
    if (!canAdvance() || saving) return;
    if (currentStepKey === 'parentEmail') {
      if (parentEmailRequired && !parentEmail.trim().includes('@')) {
        setParentEmailError('Enter a valid parent email address');
        return;
      }
    }
    if (isLastStep) {
      void handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  if (!mounted) return null;

  const progressPct = Math.round(((step + (canAdvance() ? 1 : 0)) / totalSteps) * 100);

  const mandatoryNote =
    board === 'cbse' && grade >= 9 && grade <= 10
      ? `Maths & Science are mandatory for CBSE Class ${grade}.`
      : null;

  const gate = (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Complete your profile"
    >
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Purple header with Vidya avatar */}
        <div className="bg-[#534AB7] px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logos/vidya/vidya-avatar-64.png"
              alt="Vidya"
              className="w-10 h-10 rounded-full bg-white/20 object-cover"
              width={40}
              height={40}
            />
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">
                Complete your profile
              </h2>
              <p className="text-indigo-200 text-sm leading-tight">
                Help Vidya personalise your learning
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-indigo-200">
            {step + 1} of {totalSteps}
          </p>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Language ──────────────────────────────────────────────── */}
          {currentStepKey === 'language' && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Which language do you prefer?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGE_OPTIONS.map((lang) => (
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

          {/* ── Board ─────────────────────────────────────────────────── */}
          {currentStepKey === 'board' && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Which board do you study under?
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {BOARD_OPTIONS.map((b) => (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => { setBoard(b.slug); setSubjects([]); }}
                    className={[
                      'flex items-start gap-4 rounded-xl border-2 px-4 py-4 min-h-[44px] text-left transition-all',
                      board === b.slug
                        ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 hover:border-[#534AB7]/40',
                    ].join(' ')}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        board === b.slug
                          ? 'border-[#534AB7] bg-[#534AB7]'
                          : 'border-gray-300 dark:border-slate-500'
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

          {/* ── Grade ─────────────────────────────────────────────────── */}
          {currentStepKey === 'grade' && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                Which class are you in?
              </h3>
              {board && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {BOARD_OPTIONS.find((b) => b.slug === board)?.label}
                </p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setGrade(g); setSubjects([]); }}
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
            </section>
          )}

          {/* ── Subjects ──────────────────────────────────────────────── */}
          {currentStepKey === 'subjects' && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                Which subjects?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Select up to 6. Tap a subject to add or remove it.
              </p>

              {mandatoryNote && (
                <div className="mb-3 rounded-lg bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-3 py-2">
                  <p className="text-xs text-[#534AB7] dark:text-indigo-300 font-medium">
                    {mandatoryNote}
                  </p>
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
                      (m) =>
                        m === subj.slug.toLowerCase() ||
                        subj.slug.toLowerCase().startsWith(m),
                    );
                    const selected = subjects.includes(subj.slug);
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => toggleSubject(subj.slug, isMandatory)}
                        aria-pressed={selected}
                        title={isMandatory ? 'Mandatory -- cannot be removed' : undefined}
                        className={[
                          'flex items-center gap-2 min-h-[44px] rounded-xl border-2 px-3 text-sm font-medium text-left transition-all',
                          selected
                            ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/40',
                          isMandatory ? 'opacity-80' : '',
                        ].join(' ')}
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
                          <span className="ml-auto text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                            Required
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── Parent Email ───────────────────────────────────────────── */}
          {currentStepKey === 'parentEmail' && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {parentEmailRequired
                  ? "Parent's email address"
                  : "Parent's email (optional)"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {parentEmailRequired
                  ? "Required for students under 13 -- we send weekly progress reports."
                  : "Add a parent email to share your progress reports."}
              </p>
              <div>
                <label
                  htmlFor="gate-parent-email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Parent email
                  {parentEmailRequired ? (
                    <span className="text-[#E24B4A] ml-1">*</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs">(optional)</span>
                  )}
                </label>
                <input
                  id="gate-parent-email"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => {
                    setParentEmail(e.target.value);
                    if (parentEmailError) setParentEmailError('');
                  }}
                  placeholder="parent@example.com"
                  required={parentEmailRequired}
                  className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#534AB7] dark:focus:border-indigo-400 transition-colors"
                />
                {parentEmailError && (
                  <p role="alert" className="mt-1 text-xs text-[#E24B4A] dark:text-red-400">
                    {parentEmailError}
                  </p>
                )}
              </div>
            </section>
          )}

          {saveError && (
            <p role="alert" className="mt-4 text-xs text-[#E24B4A] dark:text-red-400">
              {saveError}
            </p>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canAdvance() || saving}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-[#534AB7]/25"
            >
              {saving
                ? 'Saving...'
                : isLastStep
                ? 'Save & continue'
                : 'Continue →'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  // Render via portal so the overlay sits outside any scroll-container ancestor.
  return createPortal(gate, document.body);
}
