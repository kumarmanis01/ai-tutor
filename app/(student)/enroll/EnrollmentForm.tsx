'use client';

/**
 * FILE OBJECTIVE:
 * - Single-page flat enrollment form for new students.
 * - Collects: name, DOB, language, board, grade, school, subjects,
 *   self phone, self email, parent phone, parent email.
 * - After save: if DOB < 13 (DPDP), shows inline parent OTP step.
 * - After OTP (or no OTP needed): redirects to /enroll/diagnostic-queue.
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for flat enrollment flow
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectOption {
  id: string;
  name: string;
  slug: string;
}

interface ClassOption {
  id: string;
  grade: number;
  slug: string;
  subjects: SubjectOption[];
}

interface BoardOption {
  id: string;
  name: string;
  slug: string;
  classes: ClassOption[];
}

interface InitialData {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  language: string;
  board: string;
  grade: string;
  schoolName: string;
  subjects: string[];
  parentEmail: string;
  parentPhone: string;
  parentVerifiedAt: string | null;
}

interface Props {
  userId: string;
  initialData: InitialData;
  hierarchy: BoardOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
];

function calcAge(dobStr: string): number {
  if (!dobStr) return 0;
  const dob = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const INPUT_CLS =
  'w-full min-h-[44px] px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] placeholder-gray-400 dark:placeholder-gray-500';

const SELECT_CLS =
  'w-full min-h-[44px] px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] appearance-none';

const LABEL_CLS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const ERR_CLS = 'text-xs text-[#E24B4A] mt-1';

// ── OTP digit input ───────────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));
  const handleChange = (i: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next = Array(6).fill('');
    digits.forEach((d, idx) => { next[idx] = d; });
    onChange(next);
    const lastFilled = Math.min(digits.length, 5);
    refs.current[lastFilled]?.focus();
  };
  return (
    <div className="flex gap-2 justify-center">
      {Array(6).fill(null).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="w-10 h-12 text-center text-lg font-semibold rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#534AB7] disabled:opacity-50"
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EnrollmentForm({ initialData, hierarchy }: Props) {
  const router = useRouter();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialData.name);
  const [dob, setDob] = useState(initialData.dateOfBirth);
  const [language, setLanguage] = useState(initialData.language || 'en');
  const [board, setBoard] = useState(initialData.board);
  const [grade, setGrade] = useState(initialData.grade);
  const [schoolName, setSchoolName] = useState(initialData.schoolName);
  const [selectedSubjectSlugs, setSelectedSubjectSlugs] = useState<Set<string>>(
    new Set(initialData.subjects),
  );
  const [selfPhone, setSelfPhone] = useState(initialData.phone || '+91');
  const [selfEmail, setSelfEmail] = useState(initialData.email);
  const [parentPhone, setParentPhone] = useState(initialData.parentPhone || '+91');
  const [parentEmail, setParentEmail] = useState(initialData.parentEmail);

  // ── UI state ────────────────────────────────────────────────────────────────
  type FormPhase = 'form' | 'otp';
  const [phase, setPhase] = useState<FormPhase>('form');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpChannels, setOtpChannels] = useState<{ email: string | null; whatsapp: string | null } | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived state ───────────────────────────────────────────────────────────
  const selectedBoard = hierarchy.find((b) => b.slug === board) ?? null;
  const selectedClass = selectedBoard?.classes.find((c) => String(c.grade) === grade) ?? null;
  const availableSubjects = selectedClass?.subjects ?? [];
  const ageFromDob = dob ? calcAge(dob) : null;
  const needsParentFields = ageFromDob !== null && ageFromDob < 13;

  // Reset grade/subjects when board changes
  useEffect(() => {
    setGrade('');
    setSelectedSubjectSlugs(new Set());
  }, [board]);

  // Reset subjects when grade changes
  useEffect(() => {
    setSelectedSubjectSlugs(new Set());
  }, [grade]);

  // ── Subject toggle ──────────────────────────────────────────────────────────
  function toggleSubject(slug: string) {
    setSelectedSubjectSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  // ── OTP cooldown ────────────────────────────────────────────────────────────
  function startCooldown() {
    setOtpCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setOtpCooldown((s) => {
        if (s <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  // ── Form submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch('/api/enroll/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dateOfBirth: dob,
          language,
          board,
          grade,
          schoolName,
          subjects: [...selectedSubjectSlugs],
          selfPhone,
          selfEmail,
          parentPhone: needsParentFields ? parentPhone : undefined,
          parentEmail: needsParentFields ? parentEmail : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.fields) {
          setFieldErrors(json.fields as Record<string, string>);
        } else {
          setGlobalError(json?.message || 'Could not save. Please try again.');
        }
        return;
      }

      if (json.needsParentConsent && !json.parentConsentAlreadyVerified) {
        setPhase('otp');
        // Auto-send OTP immediately
        await sendOtp();
      } else {
        router.push('/enroll/diagnostic-queue');
      }
    } catch {
      setGlobalError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── OTP send ────────────────────────────────────────────────────────────────
  async function sendOtp() {
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/enroll/send-parent-otp', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(json?.error || 'Could not send code. Please try again.');
        return;
      }
      setOtpSent(true);
      setOtpChannels(json.channels ?? null);
      startCooldown();
    } catch {
      setOtpError('Could not send code. Please try again.');
    } finally {
      setOtpSending(false);
    }
  }

  // ── OTP verify ──────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) { setOtpError('Enter all 6 digits.'); return; }
    setOtpVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/enroll/verify-parent-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.verified) {
        setOtpError(json?.error || 'Incorrect code. Please try again.');
        return;
      }
      router.push('/enroll/diagnostic-queue');
    } catch {
      setOtpError('Could not verify. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  }

  // ── Render: OTP phase ───────────────────────────────────────────────────────
  if (phase === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-white dark:bg-slate-950">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" className="w-8 h-8" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Parent approval needed
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {otpSent && otpChannels ? (
                <>
                  A verification code has been sent to
                  {otpChannels.email && (
                    <> <span className="font-medium text-gray-700 dark:text-gray-300">{otpChannels.email}</span></>
                  )}
                  {otpChannels.email && otpChannels.whatsapp && ' and'}
                  {otpChannels.whatsapp && (
                    <> <span className="font-medium text-gray-700 dark:text-gray-300">WhatsApp</span></>
                  )}.
                </>
              ) : (
                'We need a parent to approve this account before your child can continue.'
              )}
            </p>
          </div>

          {/* OTP form */}
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            {otpSent ? (
              <>
                <OtpInput value={otpDigits} onChange={setOtpDigits} disabled={otpVerifying} />
                {otpError && (
                  <p className="text-center text-sm text-[#E24B4A]">{otpError}</p>
                )}
                <button
                  type="submit"
                  disabled={otpVerifying || otpDigits.join('').length !== 6}
                  className="w-full min-h-[44px] bg-[#534AB7] hover:bg-[#4840a3] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {otpVerifying ? 'Verifying...' : 'Verify'}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={otpCooldown > 0 || otpSending}
                    className="text-sm text-[#534AB7] disabled:text-gray-400 underline-offset-2 hover:underline disabled:no-underline"
                  >
                    {otpCooldown > 0
                      ? `Resend in ${otpCooldown}s`
                      : otpSending
                      ? 'Sending...'
                      : 'Resend code'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {otpError && (
                  <p className="text-center text-sm text-[#E24B4A]">{otpError}</p>
                )}
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={otpSending}
                  className="w-full min-h-[44px] bg-[#534AB7] hover:bg-[#4840a3] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {otpSending ? 'Sending...' : 'Send verification code'}
                </button>
              </>
            )}
          </form>

          <button
            type="button"
            onClick={() => setPhase('form')}
            className="mt-6 w-full text-center text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Edit contact details
          </button>
        </div>
      </div>
    );
  }

  // ── Render: form phase ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" className="w-6 h-6" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Tell us about yourself
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set up your learning profile to get started with Vidya, your AI tutor.
          </p>
        </div>

        {globalError && (
          <div className="mb-4 p-3 rounded-xl bg-[#FCEBEB] dark:bg-[#E24B4A]/10 text-sm text-[#E24B4A]">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="enroll-name" className={LABEL_CLS}>Full name</label>
            <input
              id="enroll-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              required
              className={INPUT_CLS}
            />
            {fieldErrors.name && <p className={ERR_CLS}>{fieldErrors.name}</p>}
          </div>

          {/* Date of birth */}
          <div>
            <label htmlFor="enroll-dob" className={LABEL_CLS}>Date of birth</label>
            <input
              id="enroll-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              className={INPUT_CLS}
            />
            {fieldErrors.dateOfBirth && <p className={ERR_CLS}>{fieldErrors.dateOfBirth}</p>}
          </div>

          {/* Language */}
          <div>
            <label htmlFor="enroll-lang" className={LABEL_CLS}>Language of study</label>
            <div className="relative">
              <select
                id="enroll-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
                className={SELECT_CLS}
              >
                <option value="">Select language</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </div>
            {fieldErrors.language && <p className={ERR_CLS}>{fieldErrors.language}</p>}
          </div>

          {/* Board */}
          <div>
            <label htmlFor="enroll-board" className={LABEL_CLS}>Board</label>
            <div className="relative">
              <select
                id="enroll-board"
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                required
                className={SELECT_CLS}
              >
                <option value="">Select board</option>
                {hierarchy.map((b) => (
                  <option key={b.id} value={b.slug}>{b.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </div>
            {fieldErrors.board && <p className={ERR_CLS}>{fieldErrors.board}</p>}
          </div>

          {/* Grade */}
          <div>
            <label htmlFor="enroll-grade" className={LABEL_CLS}>Grade</label>
            <div className="relative">
              <select
                id="enroll-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                required
                disabled={!board}
                className={SELECT_CLS}
              >
                <option value="">{board ? 'Select grade' : 'Select board first'}</option>
                {selectedBoard?.classes.map((c) => (
                  <option key={c.id} value={String(c.grade)}>Grade {c.grade}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </div>
            {fieldErrors.grade && <p className={ERR_CLS}>{fieldErrors.grade}</p>}
          </div>

          {/* School */}
          <div>
            <label htmlFor="enroll-school" className={LABEL_CLS}>School name <span className="font-normal text-gray-400">(optional)</span></label>
            <input
              id="enroll-school"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Your school name"
              className={INPUT_CLS}
            />
          </div>

          {/* Subjects */}
          <div>
            <label className={LABEL_CLS}>Subjects</label>
            {availableSubjects.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
                {board && grade ? 'No subjects available for this board and grade.' : 'Select board and grade to see subjects.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableSubjects.map((s) => {
                  const checked = selectedSubjectSlugs.has(s.slug);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.slug)}
                      className={[
                        'min-h-[44px] px-3 py-2 rounded-xl border-2 text-sm font-medium text-left transition-colors',
                        checked
                          ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-[#9d97e3]'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/50',
                      ].join(' ')}
                      aria-pressed={checked}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
            {fieldErrors.subjects && <p className={ERR_CLS}>{fieldErrors.subjects}</p>}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Contact details</p>
          </div>

          {/* Self phone */}
          <div>
            <label htmlFor="enroll-self-phone" className={LABEL_CLS}>Your phone number</label>
            <input
              id="enroll-self-phone"
              type="tel"
              value={selfPhone}
              onChange={(e) => setSelfPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              autoComplete="tel"
              className={INPUT_CLS}
            />
          </div>

          {/* Self email */}
          <div>
            <label htmlFor="enroll-self-email" className={LABEL_CLS}>Your email <span className="font-normal text-gray-400">(optional)</span></label>
            <input
              id="enroll-self-email"
              type="email"
              value={selfEmail}
              onChange={(e) => setSelfEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className={INPUT_CLS}
            />
            {fieldErrors.selfEmail && <p className={ERR_CLS}>{fieldErrors.selfEmail}</p>}
          </div>

          {/* Parent contact (shown conditionally on DPDP age) */}
          {needsParentFields && (
            <div className="rounded-2xl border border-[#534AB7]/20 bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#534AB7] dark:text-[#9d97e3]">Parent approval required</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    As per India's DPDP Act, students under 13 need a parent's approval. We'll send a verification code to your parent.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="enroll-parent-phone" className={LABEL_CLS}>
                  Parent WhatsApp number <span className="font-normal text-gray-400">(recommended)</span>
                </label>
                <input
                  id="enroll-parent-phone"
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  autoComplete="tel"
                  className={INPUT_CLS}
                />
                {fieldErrors.parentPhone && <p className={ERR_CLS}>{fieldErrors.parentPhone}</p>}
              </div>

              <div>
                <label htmlFor="enroll-parent-email" className={LABEL_CLS}>
                  Parent email <span className="font-normal text-gray-400">(optional if phone provided)</span>
                </label>
                <input
                  id="enroll-parent-email"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@email.com"
                  autoComplete="email"
                  className={INPUT_CLS}
                />
                {fieldErrors.parentEmail && <p className={ERR_CLS}>{fieldErrors.parentEmail}</p>}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[48px] bg-[#534AB7] hover:bg-[#4840a3] disabled:opacity-50 text-white font-semibold rounded-xl text-base transition-colors mt-2"
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
